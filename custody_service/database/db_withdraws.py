from custody_service.custom_types import ChainId, AvailableTokenInfo
from typing import TypedDict, Optional


class AvsSignature(TypedDict):
    verifyingKey: str
    signature: str

class WithdrawDoc(TypedDict):
    id: str
    agent: str
    signature: list[str]
    token: AvailableTokenInfo
    targetChain: str
    amount: int
    toAddress: str
    status: str
    avsSignature: Optional[AvsSignature]
    transferTx: Optional[str]


schema = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["id", "agent", "signatures", "token", "targetChain", "amount", "toAddress", "status"],
        "properties": {
            "id": {
                "bsonType": "string",
                "description": "id must be a string and is required"
            },
            "agent": {
                "bsonType": "string",
                "description": "agent must be a string and is required"
            },
            "signatures": {
                "bsonType": "array",
                "items": {
                    "bsonType": "string",
                    "description": "Each signature must be a hex string"
                },
                "description": "signatures must be an array of hex string and is required"
            },
            "token": {
                "bsonType": "object",
                "required": ["symbol", "decimals"],
                "properties": {
                    "symbol": {
                        "bsonType": "string",
                        "description": "token.symbol must be an string and is required"
                    },
                    "name": {
                        "bsonType": "string",
                        "description": "token.name must be a string and is optional"
                    },
                    "contract": {
                        "bsonType": "string",
                        "description": "token.contract must be an string and is required"
                    },
                    "decimals": {
                        "bsonType": "int",
                        "minimum": 0,
                        "description": "token.decimals must be a non-negative integer and is required"
                    }
                }
            },
            "targetChain": {
                "enum": [chain.value for chain in ChainId],
                "description": "targetChain must be either 'SOL' or 'TON' and is required"
            },
            "amount": {
                "bsonType": "int",
                "description": "amount must be an integer and is required"
            },
            "toAddress": {
                "bsonType": "string",
                "description": "toAddress hash must be a string and is required"
            },
            "status": {
                "enum": ["initialized", "approved", "in-progress", "transferred"],
                "description": "transferred must be a boolean and it is required.",
            },
            "avsSignature": {
                "bsonType": "object",
                "required": ["verifyingKey", "signature", "nonSigners"],
                "properties": {
                    "verifyingKey": {
                        "bsonType": "string",
                        "description": "avs_signature.verifyingKey must be a string and is required"
                    },
                    "signature": {
                        "bsonType": "string",
                        "description": "avs_signature.signature must be a string and is optional"
                    }
                }
            },
            "transferTx": {
                "bsonType": "string",
                "description": "transferTx hash must be a string and is required"
            },
        }
    }
}


def init(db, collection_name):
    # return if collection exist
    if collection_name in db.list_collection_names():
        return

    db.create_collection(
        collection_name,
        validator=schema
    )
    collection = db[collection_name]
    collection.create_index("id", unique=True)
