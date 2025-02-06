import { Address, beginCell, Cell, MessageRelaxed, OpenedContract, toNano } from "@ton/core";
import { ChainID, TokenID, ZellularDepositTx } from "./types";
import { callRpc, getEnvOrError, timeout } from "./utils";
import axios from "axios";
import { TonClient, WalletContractV5R1, Message, internal } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

const TONCENTER_API_JSON = getEnvOrError('TONCENTER_API_JSON')
const TONCENTER_API_HTTP = getEnvOrError('TONCENTER_API_HTTP')
const TONCENTER_API_KEY = getEnvOrError('TONCENTER_API_KEY')

export function normalizeAddress(address: string): string {
    return Address.parse(address).toRawString().toLowerCase();
}

export function newTonClient() {
    return new TonClient({
        endpoint: TONCENTER_API_JSON,
        apiKey: TONCENTER_API_KEY,
    });
}

export async function callTonRpc(method: string, params?: any, id: number = 1) {
    await timeout(1000);
    return callRpc(TONCENTER_API_JSON, method, params, id)
}

export async function getLastBlock() {
    const info = await callTonRpc("getMasterchainInfo")
    return info.last.seqno
}

export async function getBlockTransactions(block: number) {
    let result = await callTonRpc(
        "getBlockTransactions",
        {
            "workchain": -1,
            "shard": "-9223372036854775808",
            "seqno": block
        }
    )
    return result.transactions
}

export type V3ApiPath = 'masterchainInfo' | 'traces' | 'transactions' | 'jetton/transfers'

export async function callApiV3(path: V3ApiPath, params?: any) {
    await timeout(1000);
    const urlParams = new URLSearchParams({
        ...params,
        api_key: TONCENTER_API_KEY
    });
    const endpoint = `${TONCENTER_API_HTTP}/${path}?${urlParams.toString()}`
    const response = await axios.get(endpoint, {headers: {"Accept": "application/json"}})
    return response.data;
}

export async function getMasterChainInfo() {
    return await callApiV3("masterchainInfo");
}

export interface ParamsWithApiKey {
    start_lt?: number | string;
    end_lt?: number | string;
    limit?: number | string;
    offset?: number | string;
    sort?:'desc'|'asc';
    api_key?: string;
}

export interface GetTracesParams extends ParamsWithApiKey {
    account?: string | string[];
    trace_id?: string[];
    tx_hash?: string;
    msg_hash?: string;
}

export async function getTraces(params:GetTransactionsParams) {
    const paramsWithDefaults: GetTracesParams = {
        // default options
        limit:100, 
        offset:0, 
        sort: 'desc',
        // user options
        ...params
    }
    // const account:string[] = address.map(addr => Address.parse(addr).toRawString().toUpperCase())
    // @ts-ignore
    return await callApiV3('traces', paramsWithDefaults);
    
}

export interface GetTransactionsParams extends ParamsWithApiKey {
    account?: string[];
}

export async function getTransactions(params:GetTransactionsParams) {
    const paramsWithDefaults = {
        // default options
        limit:100, 
        offset:0, 
        sort: 'asc',
        // user options
        ...params
    }
    // const account:string[] = address.map(addr => Address.parse(addr).toRawString().toUpperCase())
    // @ts-ignore
    return await callApiV3('transactions', paramsWithDefaults);
    
}

export async function getTonDeposits(params: GetTransactionsParams): Promise<ZellularDepositTx[]> {
    const {transactions, address_book} = await getTransactions(params);
    // console.log("new ton deposits", transactions)
    let normalAccounts:any = params.account.map(normalizeAddress)
    return transactions
        // keep only transactions with comment/memo/tag
        .filter(t => !!t.in_msg.message_content?.decoded?.comment)
        .filter(tx => {
            if (tx && tx.in_msg && normalAccounts.includes(tx.in_msg.destination.toLowerCase()) && parseInt(tx.in_msg.value) > 0) {
                const forwarding_ton = tx.out_msgs.find(msg => parseInt(msg.value) > 0)
                return !forwarding_ton;
            }
            return false;
        })
        .map(tx => {
            tx.account = address_book[tx.account].user_friendly;
            if(!!tx.in_msg.source)
                tx.in_msg.source = address_book[tx.in_msg.source].user_friendly;
            if(!!tx.in_msg.destination)
                tx.in_msg.destination = address_book[tx.in_msg.destination].user_friendly;
            tx.out_msgs = tx.out_msgs.map(m => {
                if(m.source)
                    m.source = address_book[m.source].user_friendly;
                if(m.destination)
                    m.destination = address_book[m.destination].user_friendly;
                return m
            })
            return tx;
        })
        .map((t):ZellularDepositTx => {
            const comment = t.in_msg.message_content.decoded.comment
            return {
                chain: ChainID.Ton,
                block: t.mc_block_seqno,
                agent: '',
                account: 0,
                user: 0,
                txHash: t.hash,
                address: t.in_msg.destination,
                deposit: {
                    token: TokenID.Ton,
                    // contract: undefined,
                    amount: t.in_msg.value,
                    decimals: 9,
                },
                extra: {
                    lt: t.lt,
                    comment,
                }
            }
        })
}

function extractComment(base64Payload) {
    try {
        const payloadBytes = Buffer.from(base64Payload, "base64");
        const cell = Cell.fromBoc(payloadBytes)[0];
        const bits = cell.bits;

        if (bits.length > 0) {
            // ignore first 32 bits.
            const memoInHex = bits.toString().substr(8);
            return Buffer.from(memoInHex, 'hex').toString('utf-8');
        } else {
            return null;
        }
    } catch (error) {
        return null;
    }
}

export interface GetJettonTransfersOptions extends ParamsWithApiKey {
    owner_address: string[];
    start_lt?: number,
    end_lt?: number,
    direction?: 'in' | 'out';
}

export async function getJettonTransfers(options: GetJettonTransfersOptions): Promise<ZellularDepositTx[]> {
    const params = {
        // default options
        direction: 'in', 
        limit:100, 
        offset:0,
        sort: 'asc',
        // user options
        ...options
    }

    const {jetton_transfers, address_book, metadata} = await callApiV3('jetton/transfers', params);

    const replaceFields = ['source', 'destination', 'source_wallet', 'response_destination']
    return jetton_transfers
        // filter and keep transactions that have comment
        .filter(t => !!t.forward_payload) 
        // replace account-id with human readable address
        .map(tx => {
            for(let field of replaceFields)
                tx[field] = address_book[tx[field]].user_friendly;
            tx["jetton_master"] = {
                address: address_book[tx['jetton_master']].user_friendly,
                ...metadata[tx['jetton_master']]
            }
            return tx;
        })
        // convert to ZellularDepositTx
        .map(t => {
            const comment = extractComment(t.forward_payload)
            const tokenInfo = t.jetton_master.token_info[0]
            return {
                chain: ChainID.Ton,
                agent: '',
                account: 0,
                user: 0,
                txHash: t.transaction_hash,
                address: t.destination,
                deposit: {
                    token: tokenInfo.symbol || tokenInfo.name,
                    contract: t.jetton_master.address,
                    amount: t.amount,
                    decimals: parseInt(tokenInfo.extra?.decimals || 0),
                },
                extra: {
                    lt: t.transaction_lt,
                    comment,
                }
            }
        })
}

export interface CallAndWaitParams<C> {
    wallet: OpenedContract<WalletContractV5R1>;
    secretKey: Buffer;
    contract: OpenedContract<C>,
    method: string,
    args: any;
}   

function traceIncludesBodyHash(transactions, bodyHash): boolean {
    for(const {out_msgs} of transactions) {
        for(const m of out_msgs) {
            if(m.message_content.hash === bodyHash)
                return true;
        }
    }
    return false
}

/**
 * 
 * @param {CallAndWaitParams} params - query filter
 * @returns msg_hash of transaction
 */
export async function callContractAndWait<C>(params: CallAndWaitParams<C>) {
    const {wallet, secretKey, contract, method, args} = params;

    // @ts-ignore
    const contractAddress = contract.address.toString();
    
    const {transactions} = await getTransactions({
        account: [contractAddress],
        sort: 'desc', limit: 1, offset: 0
    });
    const start_lt = BigInt(transactions[0]?.lt || '0') + 1n;

    const txBody: Cell = await contract[method](wallet.sender(secretKey), args);
    const txBodyHash = txBody.hash().toString('base64');
    // console.log({
    //     body: txBody.bits.toString(),
    //     bodyHash: txBody.hash().toString('base64'),
    // });

    let startTime = Date.now();
    while(Date.now() - startTime < 120e3) {
        await timeout(3000);

        let traces, addressBook, metadata;
        try {
            const result = await getTraces({
                account: contractAddress,
                start_lt: start_lt.toString(),
                limit: 1000,
            })
            traces = result.traces;
            addressBook = result.address_book
            metadata = result.metadata
        }
        catch {
            continue;
        }

        if(traces.length > 0) {
            for(const t of traces){
                const {is_incomplete, trace, transactions} = t;
                
                // check if in_msg_hash included in the trace
                if(is_incomplete || !traceIncludesBodyHash(Object.values(transactions), txBodyHash)) {
                    continue;
                }

                for(const tx of Object.values(transactions)) {
                    // @ts-ignore
                    const {description, in_msg} = tx
                    if(description.compute_ph.success != true) {
                        let contract = in_msg.destination
                        let userFriendlyAddress = addressBook[contract]?.user_friendly
                        if(!!metadata[contract]) {
                            contract = {
                                address: userFriendlyAddress,
                                ...metadata[contract].token_info[0]
                            }
                        }
                        else {
                            contract = userFriendlyAddress;
                        }
                        throw {
                            message: "Transaction aborted",
                            detail: {
                                // @ts-ignore
                                exitCode: description.compute_ph.exit_code,
                                contract
                            }
                        }
                    }
                }

                return t.external_hash
            }
        }
    }
    throw "Transaction confirmation timeout"
}

