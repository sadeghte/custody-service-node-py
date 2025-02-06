import { MongoClient, Db, Collection } from "mongodb";
import * as dotenv from "dotenv";
import * as dbDeposits from "./db-deposits"
import * as dbDepositAddrs from "./db-deposit-addrs"
import * as dbWithdraws from "./db-withdraws"
import { ChainID, DepositAddressDoc } from "../types";

dotenv.config();


let db: Db;
let addressCollection: Collection;
let depositsCollection: Collection;
let withdrawsCollection: Collection;


export async function init() {
    if (!process.env.MONGODB)
        throw "MONGODB env variables not loaded correctly.";

    const client = new MongoClient(process.env.MONGODB);
    await client.connect();
    db = client.db();

    await dbDepositAddrs.init(db, "deposit_addresses");
    await dbDeposits.init(db, "deposits");
    await dbWithdraws.init(db, "withdraws");

    addressCollection = db.collection("deposit_addresses");
    depositsCollection = db.collection("deposits");
    withdrawsCollection = db.collection("withdraws");

    console.log("MongoDB connected and collections initialized.");
}

// Get deposit addresses
export async function getDepositAddresses(filter: { agent?: string, chain?: string } = {}): Promise<DepositAddressDoc[]> {
    // @ts-ignore
    return addressCollection.find(filter).toArray();
}

type GetDepositsOptions = {
    chain?: string,
    agent?: string,
    account?: number,
    user?: number,
    confirmed?: boolean,
    transferred?: boolean,
}

export async function getDeposits(options: GetDepositsOptions) {
    return depositsCollection.find(options).toArray();
}

// Update a deposit
export async function updateDeposit(filter: Record<string, any>, update: Record<string, any>) {
    return depositsCollection.updateOne(filter, update);
}

export async function getChainLastDeposit(chain: ChainID) {
    let sortQuery;
    switch (chain) {
        case ChainID.Solana:
            sortQuery = { $addFields: { sortNumber: { $toLong: "block" } } };
            break;
        case ChainID.Ton:
            sortQuery = { $addFields: { sortNumber: { $toLong: "$extra.lt" } } };
            break;
        default:
            throw `database.getChainLastDeposit: Unknown chain ${chain}`
    }
    return Promise.all([
        // native token search
        depositsCollection.aggregate([
            { $match: { "chain": chain, "deposit.contract": { $exists: false } } },
            sortQuery,
            { $sort: { sortNumber: -1 } },
            { $limit: 1 }
        ])
            .toArray()[0],
        // other tokens search
        depositsCollection.aggregate([
            { $match: { "chain": chain, "deposit.contract": { $exists: true } } },
            sortQuery,
            { $sort: { sortNumber: -1 } },
            { $limit: 1 }
        ])
            .toArray()[0],
    ])
}

type GetWithdrawsQuery = {
    targetChain: string,
    status?: dbWithdraws.WithdrawStatus,
    transferTx?: string | { "$exists": boolean }
}
export async function getWithdraws(query: GetWithdrawsQuery): Promise<dbWithdraws.WithdrawDoc[]> {
    // @ts-ignore
    return withdrawsCollection.find(query).toArray();
}
