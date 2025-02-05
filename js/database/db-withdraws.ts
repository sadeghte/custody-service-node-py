import { AvailableTokenInfo, ChainID } from "../types";
import { Db, MongoClient, Collection, Document, CreateIndexesOptions } from "mongodb";

// Define TypeScript interfaces for the document schema
interface AvsSignature {
    verifyingKey: string;
    signature: string;
    nonSigners: string[];
}

export type WithdrawStatus = "initialized" | "approved" | "in-progress" | "transferred"

export interface WithdrawDoc extends Document {
    id: string;
    agent: string;
    signatures: string[];
    token: AvailableTokenInfo;
    targetChain: string;
    amount: number;
    toAddress: string;
    status: WithdrawStatus;
    avsSignature?: AvsSignature;
    transferTx?: string;
}

// Define JSON schema for MongoDB validation
const schema = {
    $jsonSchema: {
        bsonType: "object",
        required: ["id", "agent", "signatures", "token", "targetChain", "amount", "toAddress", "status"],
        properties: {
            id: {
                bsonType: "string",
                description: "id must be a string and is required",
            },
            agent: {
                bsonType: "string",
                description: "agent must be a string and is required",
            },
            signatures: {
                bsonType: "array",
                items: {
                    bsonType: "string",
                    description: "Each signature must be a hex string",
                },
                description: "signatures must be an array of hex strings and is required",
            },
            token: {
                bsonType: 'object',
                required: [
                    'symbol',
                    'decimals'
                ],
                properties: {
                    symbol: {
                        bsonType: 'string',
                        description: 'token.symbol must be an string and is required'
                    },
                    name: {
                        bsonType: 'string',
                        description: 'token.name must be a string and is optional'
                    },
                    contract: {
                        bsonType: 'string',
                        description: 'token.contract must be an string and is required'
                    },
                    decimals: {
                        bsonType: 'int',
                        minimum: 0,
                        description: 'token.decimals must be a non-negative integer and is required'
                    }
                }
            },
            targetChain: {
                enum: Object.values(ChainID),
                description: "targetChain must be either 'SOL' or 'TON' and is required",
            },
            amount: {
                bsonType: "int",
                description: "amount must be an integer and is required",
            },
            toAddress: {
                bsonType: "string",
                description: "toAddress must be a string and is required",
            },
            status: {
                enum: ["initialized", "approved", "in-progress", "transferred"],
                description: "status must be one of 'initialized', 'approved', 'in-progress', or 'transferred' and is required",
            },
            avsSignature: {
                bsonType: "object",
                required: ["verifyingKey", "signature"],
                properties: {
                    verifyingKey: {
                        bsonType: "string",
                        description: "avsSignature.verifyingKey must be a string and is required",
                    },
                    signature: {
                        bsonType: "string",
                        description: "avsSignature.signature must be a string and is optional",
                    },
                },
            },
            transferTx: {
                bsonType: "string",
                description: "transferTx must be a string and is optional",
            },
        },
    },
};

// Initialize the collection with schema validation and indexes
export async function init(db: Db, collectionName: string): Promise<Collection<WithdrawDoc>> {
    const existingCollections = await db.listCollections({ name: collectionName }).toArray();

    // Return if the collection already exists
    if (existingCollections.length > 0) {
        return db.collection<WithdrawDoc>(collectionName);
    }

    // Create the collection with the validator
    await db.createCollection(collectionName, {
        validator: { $jsonSchema: schema.$jsonSchema },
    });

    const collection = db.collection<WithdrawDoc>(collectionName);

    // Create a unique index on the `id` field
    const indexOptions: CreateIndexesOptions = { unique: true };
    await collection.createIndex({ id: 1 }, indexOptions);

    return collection;
}
