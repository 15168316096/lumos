import React, { useState, StrictMode } from "react";
import { helpers, Script, config, commons } from "../../../packages/lumos";
import {createRoot} from "react-dom/client";
import { capacityOf,  phantom_sol, transfer } from "./lib";
import {
    getSolAddress,
} from "./utils"

//use mainnet config
// export const CONFIG = JSON.parse(JSON.stringify(config.predefined.LINA));
// CONFIG.SCRIPTS.OMNILOCK.TX_HASH = "0xc76edf469816aa22f416503c38d0b533d2a018e253e379f134c3985b3472c842";
//use testnet config  
export const CONFIG = JSON.parse(JSON.stringify(config.predefined.AGGRON4));
CONFIG.SCRIPTS.OMNILOCK.TX_HASH = "0x042485f2b1386f3156a1585de6fe38e3c866ffb5acbcea6cab61a37b9780e7b1";
CONFIG.SCRIPTS.OMNILOCK.CODE_HASH= "0xc039461134d79c87929eca28cb89261ec3f66cc2b5f562063da863330870598b";
//use devnet config
// export const CONFIG = JSON.parse(JSON.stringify(
//     {"PREFIX":"ckt","SCRIPTS":{"SECP256K1_BLAKE160":{"HASH_TYPE":"type","CODE_HASH":"0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8","TX_HASH":"0x285534355563245f03ce01246412a58d13031d1b55b18fee79366fe4f23b67a8","INDEX":"0x0","DEP_TYPE":"depGroup"},"SECP256K1_BLAKE160_MULTISIG":{"CODE_HASH":"0x5c5069eb0857efc65e1bca0c07df34c31663b3622fd3876c876320fc9634e2a8","HASH_TYPE":"type","TX_HASH":"0x285534355563245f03ce01246412a58d13031d1b55b18fee79366fe4f23b67a8","INDEX":"0x1","DEP_TYPE":"depGroup","SHORT_ID":1},"DAO":{"HASH_TYPE":"type","CODE_HASH":"0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e","TX_HASH":"0xb4703781f4b89dabe8ae7784b77234cc5a731e7e357985ceff77875e0982bd56","INDEX":"0x2","DEP_TYPE":"code"},"SUDT":{"CODE_HASH":"0xc5e5dcf215925f7ef4dfaf5f4b4f105bc321c02776d6e7d52a1db3fcd9d011a4","HASH_TYPE":"type","TX_HASH":"0xe12877ebd2c3c364dc46c5c992bcfaf4fee33fa13eebdf82c591fc9825aab769","INDEX":"0x0","DEP_TYPE":"code"},"ANYONE_CAN_PAY":{"CODE_HASH":"0x3419a1c09eb2567f6552ee7a8ecffd64155cffe0f1796e6e61ec088d740c1356","HASH_TYPE":"type","TX_HASH":"0xec26b0f85ed839ece5f11c4c4e837ec359f5adc4420410f6453b1f6b60fb96a6","INDEX":"0x0","DEP_TYPE":"depGroup","SHORT_ID":2},"OMNILOCK":{"CODE_HASH":"0x00be2f6151c439c79ba416e831f2c8b00f6956a7a98115ce1e6a21fc7420a263","HASH_TYPE":"type","TX_HASH":"0x425d469ac88d45546d55c51620c3457b8905a58a06b921d99dc4dd6319857b76","INDEX":"0x0","DEP_TYPE":"code"}}}
// ))
config.initializeConfig(CONFIG);

const App: React.FC = () => {
    const [solAddr, setSolAddr] = useState("");
    const [omniAddr, setOmniAddr] = useState("");
    const [omniLock, setOmniLock] = useState<Script>();
    const [balance, setBalance] = useState("-");

    const [transferAddr, setTransferAddress] = useState("");
    const [transferAmount, setTransferAmount] = useState("");

    const [isSendingTx, setIsSendingTx] = useState(false);
    const [txHash, setTxHash] = useState("");

    function connectToWallet() {
            getSolAddress(phantom_sol)
            .then((solAddr: string) => {
                const omniLockScript = commons.omnilock.createOmnilockScript({
                    auth: { flag: "SOLANA", address: solAddr },
                });

                const omniAddr = helpers.encodeToAddress(omniLockScript);

                setSolAddr(solAddr);
                setOmniAddr(omniAddr);
                setOmniLock(omniLockScript);

                return omniAddr;
            }).then((omniAddr) => capacityOf(omniAddr))
        .then((balance) => setBalance(balance.div(10 ** 8).toString() + " CKB"));
    }

    function onTransfer() {
        if (isSendingTx) return;
        setIsSendingTx(true);

        transfer({ amount: transferAmount, from: omniAddr, to: transferAddr })
            .then(setTxHash)
            .catch((e) => {
                console.log(e);
                alert(e.message || JSON.stringify(e));
            })
            .finally(() => setIsSendingTx(false));
    }

    if (!phantom_sol) return <div>phantom is not installed</div>;
    if (!solAddr) return <button onClick={connectToWallet}>Connect to phantom</button>;

    return (
        <div>
            <ul>
                <li>Sol Address: {solAddr}</li>
                <li>Nervos Address(Omni): {omniAddr}</li>
                <li>
                    Current Omni lock script:
                    <pre>{JSON.stringify(omniLock, null, 2)}</pre>
                </li>

                <li>Balance: {balance}</li>
            </ul>

            <div>
                <h2>Transfer to</h2>
                <label htmlFor="address">Address</label>&nbsp;
                <input id="address" type="text" onChange={(e) => setTransferAddress(e.target.value)} placeholder="ckt1..." />
                <br />
                <label htmlFor="amount">Amount</label>
                &nbsp;
                <input id="amount" type="text" onChange={(e) => setTransferAmount(e.target.value)} placeholder="shannon" />
                <br />
                <button onClick={onTransfer} disabled={isSendingTx}>
                    Transfer
                </button>
                <p>Tx Hash: {txHash}</p>
            </div>
        </div>
    );
};

const rootElement = document.getElementById("root");
const root = createRoot(rootElement);

root.render(
    <StrictMode>
        <App />
    </StrictMode>
);