from custody_service.custom_types import ChainId;

schema = {
    "$jsonSchema": {
        "bsonType": "object",
        "required": ["id", "key"],
        "properties": {
            "id": {
                "bsonType": "string",
                "description": "id must be a string and is required"
            },
            "key": {
                "bsonType": "object",
                "description": "key must be an object and is required"
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
    collection.create_index("id", unique=True)