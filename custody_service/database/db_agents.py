schema = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["id", "signers", "threshold"],
        "properties": {
            "id": {
                "bsonType": "string",
                "description": "ID must be a string and is required"
            },
            "signers": {
                "bsonType": "array",
                "items": {
                    "bsonType": "string",
                    "description": "Each signer must be a ETH address"
                },
                "description": "Signers must be an array of ETH address and is required"
            },
            "threshold": {
                "bsonType": "int",
                "minimum": 1,
                "description": "Threshold must be an integer and is required"
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
    collection.create_index("id", unique=True)