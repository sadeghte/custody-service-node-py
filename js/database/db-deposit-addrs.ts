import { ChainID } from "../types";
import { MongoClient, Db, Collection, IndexSpecification } from "mongodb";

interface DepositAddressModel {
  agent: string;
  account: number;
  chain: ChainID;
  index: number;
  address: string;
  memo?: string;
  active: boolean;
}

const schema = {
  $jsonSchema: {
    bsonType: "object",
    required: ["agent", "account", "chain", "user", "address", "active"],
    properties: {
      agent: {
        bsonType: "string",
        description: "agentId must be a string and is required",
      },
      account: {
        bsonType: "int",
        description: "account index must be an integer and is required",
      },
      chain: {
        enum: Object.values(ChainID),
        description: "Chain must be a string and is required",
      },
      user: {
        bsonType: "int",
        description: "address index must be an integer and is required",
      },
      address: {
        bsonType: "string",
        description: "address must be a string and is required",
      },
      memo: {
        bsonType: "string",
        description: "memo must be a string and is optional",
      },
      active: {
        bsonType: "bool",
        description: "active must be a boolean and is required",
      },
    },
  },
};

export async function init(db: Db, collectionName: string): Promise<void> {
  // Return if collection exists
  const collections = await db.listCollections({ name: collectionName }).toArray();
  if (collections.length > 0) return;

  // Create collection with schema validation
  await db.createCollection(collectionName, { validator: schema });

  const collection: Collection = db.collection(collectionName);

  // Create unique index
  await collection.createIndex(
    { 
        agent: 1 ,
        account: 1 ,
        chain: 1 ,
        user: 1 
    }, 
    { unique: true });
}
