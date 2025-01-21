from pymongo import MongoClient
from custody_service.custom_types import (
    ZellularCreateDepositAddressTx,
    ZellularRegisterTx,
    ZellularDepositTx,
    ZellularAddWithdrawTx,
    ChainId
)
from . import db_agents, db_deposit_addrs, db_deposits, db_withdraws, db_dist_keys
import os
import json
import logging, random

# Create a custom logger for PyMongo
pymongo_logger = logging.getLogger("pymongo")
pymongo_logger.setLevel(logging.ERROR)

if not os.getenv("MONGODB"):
    # raise Exception("Environment variables not loaded correctly.")
    print("Environment variables not loaded correctly.")
else:
    # Connect to MongoDB
    client = MongoClient(os.getenv("MONGODB"))  # Replace with your MongoDB URI

    # Access a specific database
    db = client.get_database()

    db_agents.init(db, "agents")
    db_deposit_addrs.init(db, "deposit_addresses")
    db_deposits.init(db, "deposits")
    db_withdraws.init(db, "withdraws")
    db_dist_keys.init(db, "dist_keys")

    agents_collection = db["agents"]
    address_collection = db["deposit_addresses"]
    deposits_collection = db["deposits"]
    withdraws_collection = db["withdraws"]
    dist_keys_collection = db["dist_keys"]


def insert_agent(agent: ZellularRegisterTx):
    agents_collection.insert_one(agent)


def get_user_agents(user_address: str):
    # agents = agents_collection.find({"signers": {"$in": [user_address]}})
    agents = agents_collection.find({
        "signers": {
            "$elemMatch": {
                # Match the exact value (case-insensitive)
                "$regex": f"^{user_address}$",
                "$options": "i"  # Case-insensitive flag
            }
        }
    })
    return agents


def insert_deposit_address(address_data: ZellularCreateDepositAddressTx):
    doc = {**address_data, "active": True}
    return address_collection.insert_one(doc)


def get_deposit_addresses(agent_id: str, chain: str):
    if agent_id is not None:
        return address_collection.find({"agent": agent_id, "chain": chain})
    else:
        return address_collection.find({"chain": chain})


def insert_deposit(deposit: ZellularDepositTx):
    return deposits_collection.insert_one(deposit)


def get_deposits(agent_id: str, account: int=None, user: int=None):
    account_condition = {"account": account} if account is not None else {}
    user_condition = {"user": user} if user is not None else {}
    return deposits_collection.find({
        "agent": agent_id,
        **account_condition,
        **user_condition,
    })

def find_withdraw(id: str):
    return withdraws_collection.find_one({"id": id})

def get_withdraws(agent: str=None, account: int=None, user: int = None, status: str = None):
    agent_condition = {"agent": agent} if agent is not None else {}
    account_condition = {"account": account} if account is not None else {}
    user_condition = {"user": user} if user is not None else {}
    status_condition = {"status": status} if status is not None else {}
    return withdraws_collection.find({
        **agent_condition,
        **account_condition,
        **user_condition,
        **status_condition,
    })
    

def approve_withdraw(id: str, avs_verifying_key: str, avs_signature: str, nonSigners: list[str]=[]):
    return withdraws_collection.update_one(
        {"id": id}, 
        {"$set": {
            "avsSignature": {
                "verifyingKey": avs_verifying_key, 
                "signature": avs_signature,
                "nonSigners": nonSigners,
            },
            "status": "approved"
        }}
    );
    

def set_withdraws_transfer_tx(ids: list[str], tx_hash: str):
    return withdraws_collection.update_many(
        {"id": {"$in": ids}}, 
        {"$set": {
            "txHash": tx_hash,
            "status": "transferred"
        }}
    )


def get_unconfirmed(chainId: ChainId):
    return deposits_collection.find({"chain": chainId.value, "confirmed": False})


def update_deposit(filter, update):
    return deposits_collection.update_one(filter, update)


def get_last_deposit(chain_id):
    pass

def insert_new_withdraw(withdraw: ZellularAddWithdrawTx):
    doc = {
        **withdraw, 
        "status": "initialized"
    }
    return withdraws_collection.insert_one(doc)

def insert_dist_key(id: str, key):
    doc = {"id": id, "key": key}
    return dist_keys_collection.insert_one(doc)

def get_dist_key(id: str):
    doc = dist_keys_collection.find_one({"id": id})
    return doc["key"] if doc is not None else None