import {
  blockchain,
  Transaction,
  OutPoint,
  Cell,
  Hash,
  CellCollector,
} from "@ckb-lumos/base";
import { RPC } from "@ckb-lumos/rpc";
import { bytes } from "@ckb-lumos/codec";
import type { CKBComponents } from "@ckb-lumos/rpc/lib/types/api";
import {
  TransactionStorage,
  PendingCell,
  createInMemoryPendingTransactionStorage,
} from "./PendingTransactionStorage";
import { filterByQueryOptions } from "@ckb-lumos/ckb-indexer/lib/ckbIndexerFilter";
import { Promisable } from "./storage";
import { CKBIndexerQueryOptions } from "@ckb-lumos/ckb-indexer/lib/type";
import { CkbIndexer } from "@ckb-lumos/ckb-indexer/lib/indexer";

type OutputsValidator = CKBComponents.OutputsValidator;

// https://github.com/nervosnetwork/ckb/blob/develop/rpc/README.md#type-status
type TRANSACTION_STATUS =
  | "pending"
  | "proposed"
  | "committed"
  | "unknown"
  | "rejected";

// TODO: batch get transactions
const isTxCompleted = async (txHash: Hash, rpc: RPC): Promise<boolean> => {
  const reponse = await rpc.getTransaction(txHash);
  return txStatusIsCompleted(reponse.txStatus.status as TRANSACTION_STATUS);
};

const txStatusIsCompleted = (txStatus: TRANSACTION_STATUS): boolean =>
  txStatus === "committed" || txStatus === "rejected";

interface TransactionManager {
  stop(): void;
  sendTransaction(tx: Transaction): Promisable<string>;
  collector(queryOptions: CKBIndexerQueryOptions): Promisable<CellCollector>;
}

type Props = {
  rpcUrl: string;
  options?: {
    pollIntervalSeconds?: number;
    // default to in memory storage
    txStorage?: TransactionStorage;
  };
};

export class PendingTransactionsManager implements TransactionManager {
  private running: boolean;
  private pollIntervalSeconds: number;
  private rpc: RPC;
  private indexer: CkbIndexer;
  private txStorage: TransactionStorage;

  constructor(payload: Props) {
    this.rpc = new RPC(payload.rpcUrl);
    this.indexer = new CkbIndexer(payload.rpcUrl);
    this.running = false;
    this.pollIntervalSeconds = payload?.options?.pollIntervalSeconds || 10;
    this.txStorage =
      payload.options?.txStorage || createInMemoryPendingTransactionStorage();

    void this.start();
  }

  private start(): void {
    this.running = true;
    void this.watchPendingTransactions();
  }

  stop(): void {
    this.running = false;
  }

  private async watchPendingTransactions(): Promise<void> {
    try {
      await this.updatePendingTransactions();
    } catch (e) {
      console.error(e);
    }
    if (this.running) {
      setTimeout(
        () => this.watchPendingTransactions(),
        this.pollIntervalSeconds * 1000
      );
    }
  }

  private async updatePendingTransactions(): Promise<void> {
    const txs = await this.txStorage.getTransactions();
    for await (const tx of txs) {
      /* remove all transactions that have already been completed */
      const txCompleted = await isTxCompleted(tx.hash, this.rpc);
      if (txCompleted) {
        this.txStorage.deleteTransactionByHash(tx.hash);
        console.log("tx: ", tx.hash, " is deteted");
      }
    }
  }

  async sendTransaction(
    tx: Transaction,
    validator: OutputsValidator = "passthrough"
  ): Promise<string> {
    const spentCellOutpoints = await this.txStorage.getSpentCellOutpoints();
    tx.inputs.forEach((input) => {
      if (
        spentCellOutpoints.some((spentCell) =>
          bytes.equal(
            blockchain.OutPoint.pack(spentCell),
            blockchain.OutPoint.pack(input.previousOutput)
          )
        )
      ) {
        throw new Error(
          `OutPoint ${input.previousOutput.txHash}@${input.previousOutput.index} has already been spent!`
        );
      }
    });
    const txHash = await this.rpc.sendTransaction(tx, validator);
    await this.txStorage.addTransaction({ ...tx, hash: txHash });
    return txHash;
  }

  async collector(
    options: CKBIndexerQueryOptions
  ): Promise<PendingCellCollector> {
    const pendingCells: Cell[] = await this.txStorage.getPendingCells();
    const filteredCreatedCells = filterByQueryOptions(pendingCells, options);

    return new PendingCellCollector(
      this.indexer.collector(options),
      await this.txStorage.getSpentCellOutpoints(),
      filteredCreatedCells as PendingCell[]
    );
  }
}

class PendingCellCollector implements CellCollector {
  spentCells: OutPoint[];
  filteredPendingCells: PendingCell[];
  liveCellCollector: CellCollector;
  constructor(
    liveCellCollector: CellCollector,
    spentCells: OutPoint[],
    filteredPendingCells: PendingCell[]
  ) {
    this.spentCells = spentCells;
    this.filteredPendingCells = filteredPendingCells;
    this.liveCellCollector = liveCellCollector;
  }

  cellIsSpent(cell: Cell): boolean {
    return this.spentCells.some((spent) =>
      bytes.equal(
        blockchain.OutPoint.pack(spent),
        blockchain.OutPoint.pack(cell.outPoint!)
      )
    );
  }

  async *collect(): AsyncGenerator<Cell> {
    for await (const cell of this.liveCellCollector.collect()) {
      if (!this.cellIsSpent(cell)) {
        yield cell;
      }
    }
    for (const cell of this.filteredPendingCells) {
      if (!this.cellIsSpent(cell)) {
        yield cell;
      }
    }
  }
}
