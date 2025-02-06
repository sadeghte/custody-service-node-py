from custody_service.custom_types import ChainId;

schema = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["chain", "txHash", "agent", "account", "user", "address", "deposit", "confirmed", "transferred"],
        "properties": {
            "chain": {
                "enum": [chain.value for chain in ChainId],
                "description": "Chain must be either 'SOL' or 'TON' and is required"
            },
            "block": {
                "bsonType": "int",
                "description": "block must be an integer and is required"
            },
            "txHash": {
                "bsonType": "string",
                "description": "Transaction hash must be a string and is required"
            },
            "agent": {
                "bsonType": "string",
                "description": "Agent must be a string and is required"
            },
            "account": {
                "bsonType": "int",
                "description": "Account must be an integer and is required"
            },
            "user": {
                "bsonType": "int",
                "description": "User must be an integer and is required"
            },
            "address": {
                "bsonType": "string",
                "description": "Address must be a string and is required"
            },
            "deposit": {
                "bsonType": "object",
                "required": ["token", "amount", "decimals"],
                "properties": {
                    "token": {
                        "bsonType": "string",
                        "description": "Token must be a string and is required"
                    },
                    "contract": {
                        "bsonType": "string",
                        "description": "Contract must be a string and is optional"
                    },
                    "amount": {
                        "bsonType": "string",
                        "description": "Amount must be a string",
                    },
                    "decimals": {
                        "bsonType": "int",
                        "minimum": 0,
                        "description": "Decimals must be a non-negative integer and is required"
                    }
                }
            },
            "extra": {
                "bsonType": "object"
            },
			"confirmed": {
				"bsonType": "bool",
				"description": "Confirmed must be a boolean and it is required.",
			},
            "transferred": {
                "bsonType": "bool",
                "description": "transferred to main vault or not.",
            },
            "transferTx": {
                "bsonType": "string",
                "description": "transfer transaction hash",
            },
        }
    }
}

def init(db, collection_name):
    # return if collection exist
    if collection_name in db.list_collection_names():
        return;
    
    db.create_collection(
        collection_name,
        validator=schema
    )
    collection = db[collection_name]
    collection.create_index("txHash", unique=True)