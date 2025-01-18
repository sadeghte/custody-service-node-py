from custody_service.custom_types import ChainId;
from pymongo import ASCENDING
from typing import TypedDict, Optional


class DepositAddressModel(TypedDict):
    agent: str
    acount: int
    chain: ChainId
    index: int
    address: str
    memo: Optional[str]
    active: bool

schema = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["agent", "account", "chain", "user", "address", "active"],
        "properties": {
            "agent": {
                "bsonType": "string",
                "description": "agentId must be a string and is required"
            },
            "account": {
                "bsonType": "int",
                "description": "account index must be an integer and is required"
            },
            "chain": {
                "enum": [chain.value for chain in ChainId],
                "description": "Chain must be string and is required"
            },
            # users indexes (user ID)
            "user": {
                "bsonType": "int",
                "description": "address index must be an integer and is required"
            },
            "address": {
                "bsonType": "string",
                "description": "address must be a string and is required"
            },
            "memo": {
                "bsonType": "string",
                "description": "memo must be a string and is optional"
            },
            "active": {
                "bsonType": "bool",
                "description": "active must be a boolean and is required"
            }
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
    collection.create_index(
        [
            ("agent", ASCENDING), 
            ("account", ASCENDING), 
            ("chain", ASCENDING), 
            ("user", ASCENDING)
        ], 
        unique=True
    )