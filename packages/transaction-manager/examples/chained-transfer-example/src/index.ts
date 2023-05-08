import { Cell, Hash, Script, blockchain } from '@ckb-lumos/base';
import { BI } from '@ckb-lumos/bi';
import { Indexer } from '@ckb-lumos/ckb-indexer';
import { initializeConfig, predefined } from '@ckb-lumos/config-manager/lib';
import { TransactionSkeleton, TransactionSkeletonType, encodeToAddress, sealTransaction } from '@ckb-lumos/helpers';
import { common } from '@ckb-lumos/common-scripts';
import { bytes } from '@ckb-lumos/codec';
import { key } from '@ckb-lumos/hd';
import { TransactionManager } from '@ckb-lumos/transaction-manager';

const ALICE_PRIVATE_KEY = '0x53815fbee34af63e686f5cad7db8074b4b8fd4473617dee2db0ae84d2c6325c4';
const ALICE_ARGS = '0xe9441c447677de3f24fc64ce03f46fd259ed5e8c';
const RPC_URL = 'https://testnet.ckb.dev';
const _100_CKB_SHANNON = 10_000_000_000;
const TX_FEE_SHANNON = 100_000;
const CONFIG = predefined.AGGRON4;
initializeConfig(CONFIG);

const indexer = new Indexer(RPC_URL);
const SECP256K1_BLAKE160 = CONFIG.SCRIPTS.SECP256K1_BLAKE160!;
const aliceLock: Script = {
  codeHash: SECP256K1_BLAKE160.CODE_HASH,
  hashType: SECP256K1_BLAKE160.HASH_TYPE,
  args: ALICE_ARGS,
};
const aliceAddress = encodeToAddress(aliceLock);
const txManager = new TransactionManager({
  providers: {
    rpcUrl: RPC_URL,
  },
});

/**
 * @description This example shows how to use transaction manager to collect cells and send a transaction.
 */
async function main() {
  const txHash1 = await transferViaTxManager();
  const txHash2 = await transferViaTxManager();
  console.log('txHash1:', txHash1);
  console.log('txHash2:', txHash2);
}

main();


async function transferViaTxManager(): Promise<Hash> {
  const cells = await collectCells();
  let txSkeleton = await transferMySelf(aliceLock, cells);
  txSkeleton = common.prepareSigningEntries(txSkeleton);
  const sig = key.signRecoverable(txSkeleton.get('signingEntries').get(0)!.message, ALICE_PRIVATE_KEY);
  const tx = sealTransaction(txSkeleton, [sig]);
  return await txManager.sendTransaction(tx);
}

async function transferMySelf(aliceLock: Script, cells: Cell[]): Promise<TransactionSkeletonType> {
  const totalCapacity = cells.reduce((a, c) => a.add(c.cellOutput.capacity), BI.from(0));
  let txSkeleton = new TransactionSkeleton({ cellProvider: indexer });
  txSkeleton = txSkeleton.update('cellDeps', (cellDeps) => {
    return cellDeps.push({
      outPoint: {
        txHash: SECP256K1_BLAKE160.TX_HASH,
        index: SECP256K1_BLAKE160.INDEX,
      },
      depType: SECP256K1_BLAKE160.DEP_TYPE,
    });
  });
  txSkeleton = txSkeleton.update('inputs', (inputs) => {
    return inputs.push(...cells);
  });

  txSkeleton = txSkeleton.update('outputs', (outputs) => {
    return outputs.push({
      cellOutput: {
        lock: aliceLock,
        capacity: totalCapacity.sub(TX_FEE_SHANNON).toHexString(),
      },
      data: '0x',
    });
  });
  txSkeleton = txSkeleton.update('witnesses', (witnesses) => {
    return witnesses.push(bytes.hexify(blockchain.WitnessArgs.pack({ lock: `0x${'00'.repeat(65)}` })));
  });

  return txSkeleton;
}

async function collectCells(): Promise<Cell[]> {
  const cellCollector = await txManager.collector({ lock: aliceLock });
  cellCollector.collect();
  const cells: Cell[] = [];
  let collectedCapacity = BI.from(0);
  for await (const cell of cellCollector.collect()) {
    if (collectedCapacity.gte(BI.from(_100_CKB_SHANNON))) break;
    if (!!cell.cellOutput.type || (!!cell.data && cell.data !== '0x')) continue;
    cells.push(cell);
    collectedCapacity = collectedCapacity.add(cell.cellOutput.capacity);
  }
  if (collectedCapacity.lt(BI.from(_100_CKB_SHANNON))) {
    throw new Error('Not enough capacity, address is ' + aliceAddress + ', go to https://faucet.nervos.org/');
  }
  return cells;
}
