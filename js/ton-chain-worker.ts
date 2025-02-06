import { Address, JettonMaster, JettonWallet, OpenedContract, TonClient, WalletContractV4, WalletContractV5R1 } from "@ton/ton";
import { mnemonicNew, mnemonicToPrivateKey, mnemonicToWalletKey } from "@ton/crypto";
import { ClusterManager } from "./cluster-manager";
import * as database from "./database/database"
import * as CustodyService from "./backend-api";
import { getEnvOrError, registerDeposits, timeout, zellularRegisterWithdrawTransfer } from "./utils";
import { ChainID, ZellularDepositTx } from "./types";
import { WithdrawDoc } from "./database/db-withdraws";
import { TonAssetman } from "./assetman/ton/assetman";
import * as TonChainUtils from "./ton-chain-utils"


const TON_ASSETMAN_ADDRESS:string = getEnvOrError('TON_ASSETMAN_ADDRESS');
const TON_MNEMONIC:string = getEnvOrError('TON_MNEMONIC');

async function detectDeposits() {
    await database.init();

    // TODO: load this values from local database

    let tonLT:number = 0, jettonLT:number = 0;

    // load from local database
    const [last_ton_deposit, last_jetton_deposit] = await database.getChainLastDeposit(ChainID.Ton)
    if(last_ton_deposit) {
        tonLT = parseInt(last_ton_deposit.extra.lt)
    }
    if(last_jetton_deposit) {
        jettonLT = parseInt(last_ton_deposit.extra.lt)
    }

    // load network LT if needed.
    if(tonLT == 0 || jettonLT == 0){
        const masterchainInfo = await TonChainUtils.getMasterChainInfo();
        const startLT = parseInt(masterchainInfo.last.start_lt);

        if(tonLT == 0)
            tonLT = startLT;
        if(jettonLT == 0)
            jettonLT = startLT;
    }
    
    console.log("Ton deposit detector:", {TON_ASSETMAN_ADDRESS, tonLT, jettonLT})

    while (true) {
        const depositWallets = await database.getDepositAddresses({ chain: 'TON' })
        const availableTokens = await CustodyService.getAvailableTokens('TON')
        const allowedTokenContracts = availableTokens.map(t => t.contract).filter(c => !!c)

        let tonDeposits: ZellularDepositTx[] = await TonChainUtils.getTonDeposits({
            account: [TON_ASSETMAN_ADDRESS],
            limit: 1000,
            start_lt: tonLT + 1,
        })
        if (tonDeposits.length > 0) {
            console.log("new ton deposit:", tonDeposits)
            tonLT = tonDeposits.reduce((max, d) => Math.max(max, parseInt(d.extra.lt)), tonLT);
        }

        let jettonDeposits: ZellularDepositTx[] = await TonChainUtils.getJettonTransfers({
            owner_address: [TON_ASSETMAN_ADDRESS],
            direction: 'in',
            start_lt: jettonLT + 1,
            limit: 1000,
        })
        // keep only allowed tokens
        jettonDeposits = jettonDeposits.filter(d => allowedTokenContracts.includes(d.deposit.contract))
        
        if (jettonDeposits.length > 0) {
            console.log("new jetton deposit:", jettonDeposits)
            jettonLT = jettonDeposits.reduce((max, d) => (Math.max(max, d.extra.lt)), 0);
        }

        let allDeposits: ZellularDepositTx[] = [
            ...tonDeposits,
            ...jettonDeposits,
        ].map(d => {
            const w = depositWallets.find(w => w.memo === d.extra.comment)
            if(!w) {
                console.log("Unknown memo when deposit", d)
                return null;
            }

            // @ts-ignore
            d.agent = w.agent,
            d.account = w.account,
            d.user = w.user

            return d;
        })

        // send to zellular network
        if(allDeposits.length > 0) {
            console.dir(`[${allDeposits.length}] deposit detected`, allDeposits)
            await registerDeposits(allDeposits)
        }

        await timeout(5000);
    }
}

async function executeWithdraws() {
    await database.init();

    const client = TonChainUtils.newTonClient()
    
    const assetman: OpenedContract<TonAssetman> = client.open<TonAssetman>(
        TonAssetman.createFromAddress(Address.parse(TON_ASSETMAN_ADDRESS))
    );

    const mnemonic = TON_MNEMONIC.split(' ')
    const key = await mnemonicToPrivateKey(mnemonic);
    const wallet = WalletContractV5R1.create({
        publicKey: key.publicKey,
        workchain: 0
    });
    const openedWallet: OpenedContract<WalletContractV5R1> = client.open(wallet);


    while(true) {

        let data = await assetman.getData();
        const withdraws:WithdrawDoc[] = await database.getWithdraws({
            targetChain: 'TON',
            status: "approved", 
            transferTx: {$exists: false}
        })
        if(withdraws.length > 0)
            console.log(`[${withdraws.length}] pending Ton chain withdraw found.`)

        if(withdraws.length > 0) {
            try {
                for(const w of withdraws) {
                    let txHash;
                    if(!!w.token.contract) {
                        // @ts-ignore
                        // txHash = await assetman.sendWithdrawJetton(sender, withdraws);
                        console.log(`withdrawing jetton ...`)
                        const jettonMinter: OpenedContract<JettonMaster> = await client.open(
                            JettonMaster.create(Address.parse(w.token.contract!))
                        )
                    
                        const assetmanJettonWallet: OpenedContract<JettonWallet> = await client.open(
                            JettonWallet.create(
                                await jettonMinter.getWalletAddress(assetman.address)
                            )
                        )
                        txHash = await TonChainUtils.callContractAndWait({
                            wallet: openedWallet,
                            secretKey: key.secretKey,
                            contract: assetman,
                            method: 'sendWithdrawJetton',
                            args: {
                                value: '0.1',
                                jettonWallet: assetmanJettonWallet.address,
                                to: Address.parse(w.toAddress),
                                amount: w.amount,
                                signature: w.avsSignature.signature,
                            }
                        })
                    }
                    else {
                        // txHash = await assetman.sendWithdrawTon(sender, withdraws);
                        console.log(`withdrawing TON ...`)
                        txHash = await TonChainUtils.callContractAndWait({
                            wallet: openedWallet,
                            secretKey: key.secretKey,
                            contract: assetman,
                            method: 'sendWithdrawTon',
                            args: {
                                value: '0.1',
                                to: Address.parse(w.toAddress),
                                amount: w.amount,
                                signature: w.avsSignature.signature,
                            }
                        })
                    }
                    console.log("withdraw transfered:", {withdraw: w, txHash})
                    
                    await zellularRegisterWithdrawTransfer([w], txHash);
                }
            }
            catch(e) {
                console.log("Error on transferring withdraws: ", e);
            }
        }

        await timeout(5000);
    }
}

export type WorkerType = "DepositDetector" | "WithdrawExecuter"

// @ts-ignore
if (ClusterManager.isPrimary) {
    // start cluster manager
    const manager = new ClusterManager<WorkerType>();
    manager.start([
        "DepositDetector",
        "WithdrawExecuter",
    ]);
} else {
    // Worker logic (if needed, it can be customized further)
    const workerId = process.env.WORKER_ID;
    const workerType: WorkerType = process.env.WORKER_TYPE! as WorkerType;
    console.log(`Worker process started with ID: ${workerId}, type: ${workerType}, PID: ${process.pid}`);

    switch (workerType) {
        case "DepositDetector":
            detectDeposits()
                .catch(e => {
                    console.log(e);
                    process.exit(0)
                })
            break;
        case "WithdrawExecuter":
            executeWithdraws()
                .catch(e => {
                    console.log(e);
                    process.exit(0)
                })
            break;
    }
}


async function test() {
    // Generate new key
    let mnemonics = await mnemonicNew();
    let keyPair = await mnemonicToPrivateKey(mnemonics);

    // Create wallet contract
    let workchain = 0; // Usually you need a workchain 0
    let wallet = WalletContractV4.create({ workchain, publicKey: keyPair.publicKey });

    // Get balance
    // let balance: bigint = await contract.getBalance();
    // let currentBlock = await getLastBlock()
    // let transactions = await getBlockTransactions(currentBlock);

    // const address = "0QBaJgPY9PqZTTSH-FErz4EUPI56hkpCzVA6OF6kEzglpXj-"
    // const address = "0QDbUFPEDe9jl-BAfbrwIGID0TRTMRWGsLJrx4hXC1Z_Aj-L"
    const address = "0QAgnUQg_DCTuDkQDZ-w9sZHdNQMd4AtCO3u-Eg6gplUbPs7"

    let tonTransfers: any[] = await TonChainUtils.getTonDeposits({ account: [address] })
    let jettonTransfers: any[] = await TonChainUtils.getJettonTransfers({ owner_address: [address] })

    // console.dir({
    //     tonTransfers,
    //     jettonTransfers
    // }, {depth: 6})

    const deposits = [
        ...tonTransfers,
        ...jettonTransfers
    ]

    console.dir({

        // transactions: transactions.length,
        deposits: deposits
    }, { depth: 6 })


    // // Create a transfer
    // let seqno: number = await contract.getSeqno();
    // let transfer = await contract.createTransfer({
    //     seqno,
    //     secretKey: keyPair.secretKey,
    //     messages: [internal({
    //         value: '1.5',
    //         to: 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N',
    //         body: 'Hello world',
    //     })]
    // });
}

// test()
//     .catch(e => console.log(e))
//     .finally(() => {
//         process.exit(0);
//     })
