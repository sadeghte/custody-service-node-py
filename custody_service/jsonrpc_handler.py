from flask import Blueprint, request, jsonify, abort
from pyfrost.network.abstract import NodesInfo, DataManager
from functools import wraps
from flask_cors import CORS
from custody_service import database
from custody_service.custom_types import ZellularTx
from custody_service.utils import get_zellular
from .zellular import Zellular
from .chain_utils import solana_chain_utils
from .chain_utils import ton_chain_utils
from .utils import get_env_or_error
import json
import logging
import types, os, secrets


zellular = get_zellular()


ASSETMAN_ADDR = {
    'SOL': get_env_or_error("SOLANA_ASSETMAN_ADDRESS"),
    'TON': get_env_or_error("TON_ASSETMAN_ADDRESS"),
}

ALL_CHIAN_UTILS = {
    'SOL': solana_chain_utils,
    'TON': ton_chain_utils
}

def request_handler(func):
    @wraps(func)
    def wrapper(self, *args, **kwargs):
        route_path = request.url_rule.rule if request.url_rule else None

        try:
            # logging.debug(
            #     f"{request.remote_addr}{route_path} Got message: {request.get_json()}"
            # )
            result: dict = func(self, *args, **kwargs)
            return result, 200
        except Exception as e:
            logging.error(
                f"Flask round1 handler => Exception occurred: {type(e).__name__}: {e}",
                exc_info=True,  # This will include the stack trace in the log
            )
            return jsonify(
                {"error": f"{type(e).__name__}: {e}", "status": "ERROR"}
            ), 500

    return wrapper

def get_available_tokens(chain: str=None):
    current_dir = os.path.dirname(__file__)
    file_path = os.path.join(current_dir, "./data/available-tokens.json")
    with open(file_path, 'r') as file:
        data = json.load(file)
        
    if chain is not None:
        data = data.get(chain, []);
        
    return data;



class JsonRpcHandler:
    def __init__(
            self,
            data_manager: DataManager,
            node_id: str,
            private: int,
            nodes_info: NodesInfo,
            caller_validator: types.FunctionType,
            data_validator: types.FunctionType,
    ) -> None:
        self.blueprint = Blueprint("jsonrpc", __name__)
        CORS(self.blueprint)
        self.private = private
        self.node_id = node_id

        # TODO: Check validator functions if it cannot get as input. and just use in decorator.

        # Abstracts:
        self.nodes_info: NodesInfo = nodes_info
        self.caller_validator = caller_validator
        self.data_validator = data_validator
        self.data_manager: DataManager = data_manager

        self.blueprint.route("/", methods=["POST"])(self.jsonrpc_handler)


    @request_handler
    def jsonrpc_handler(self):
        try:
            data = request.get_json()
            print("new rpc request: ", data)
            version = data["jsonrpc"]
            method = data["method"]
            params = data.get("params") or {}
            request_id = data.get("id")

            if version != "2.0":
                raise Exception("Invalid JSON-RPC version")

            match method:
                case "test":
                    return jsonify({
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": solana_chain_utils.get_deposit_address("", 0, "", 0)
                    })
                
                case "registerAgent":
                    signers = params["signers"]
                    threshold = params["threshold"]
                    
                    reg_tx: ZellularTx = {
                        "type": "AgentRegister",
                        "data": {
                            "signers": signers,
                            "threshold": threshold
                        }
                    }

                    index = zellular.send([reg_tx], blocking=True)
                    return jsonify({
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": index
                    })
                    
                case "getUserAgents":
                    query = database.get_user_agents(params["userAddress"])
                    result = [{**d, "_id": str(d["_id"])} for d in query]
                    return jsonify({
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": result
                    })
                    
                case "getAgentData":
                    agent = params["agent"]
                    
                    deposit_addrs = database.get_deposit_addresses(agent)
                    deposits = database.get_deposits(agent)
                    withdraws = database.get_withdraws(agent)
                    
                    return jsonify({
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": {
                            "depositAddresses": [{**d, "_id": str(d["_id"])} for d in deposit_addrs],
                            "deposits": [{**d, "_id": str(d["_id"])} for d in deposits],
                            "withdraws": [{**d, "_id": str(d["_id"])} for d in withdraws],
                        }
                    })
                    
                case "createDepositAddressRange":
                    chain = params["chain"]
                    agent = params["agent"]
                    account = params.get('account', 0);
                    if chain not in ["SOL", "TON"]:
                        raise Exception("chain not supported")
                    [addr_from, addr_to] = params["addressRange"]
                    print({chain, addr_from, addr_to, agent, account})
                    
                    txs: list[ZellularTx] = [
                        {
                            "type": "CreateDepositAddress",
                            "data": {
                                "chain": chain, 
                                "agent": agent, 
                                "account": account, 
                                "user": user, 
                                **ALL_CHIAN_UTILS[chain].get_deposit_address(
                                    ASSETMAN_ADDR[chain],
                                    agent,
                                    account,
                                    user
                                )
                            }
                        }
                        for user in range(addr_from, addr_to)
                    ]
                    index = zellular.send(txs, blocking=True)
                    return jsonify({
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": index
                    })
                    
                case "getDepositAddresses":
                    agent = params["agent"] if "agent" in params else None
                    
                    query = database.get_deposit_addresses(agent)
                    return jsonify({
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": [{**d, "_id": str(d["_id"])} for d in query]
                    })
                    
                case "getAvailableTokens":
                    chain = params.get("chain")
                    return jsonify({
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": get_available_tokens(chain),
                    })
                    
                case "getDeposits":
                    agent = params["agent"]
                    account = params["account"] if "account" in params else None
                    user = params["user"] if "user" in params else None
                    
                    query = database.get_deposits(agent, account, user)
                    return jsonify({
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": [{**d, "_id": str(d["_id"])} for d in query]
                    })
                    
                case "getWithdraws":
                    agent = params["agent"]
                    account = params["account"] if "account" in params else None
                    user = params["user"] if "user" in params else None
                    
                    if agent is None:
                        raise Exception("agent id cannot be null")
                    
                    query = database.get_withdraws(agent, account, user)
                    return jsonify({
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": [{**d, "_id": str(d["_id"])} for d in query]
                    })
                    
                case "addWithdraw":
                    agent = params["agent"]
                    signatures = params["signatures"]
                    token_symbol = params["token"]
                    target_chain = params["targetChain"]
                    amount = params["amount"]
                    to_address = params["toAddress"]
                    
                    available_tokens = get_available_tokens(target_chain)
                    token_info = next((item for item in available_tokens if item["symbol"] == token_symbol), None)
                    
                    if token_info is None:
                        raise Exception('Withdrawing token info not found')
                    
                    add_withdraw_tx: ZellularTx = {
                        "type": "AddWithdraw",
                        "data": {
                            "id": "0x"+secrets.token_hex(32), 
                            "agent": agent,
                            "signatures": signatures,
                            "token": token_info,
                            "targetChain": target_chain,
                            "amount": amount,
                            "toAddress": to_address,
                        }
                    }
                    
                    index = zellular.send([add_withdraw_tx], blocking=True)
                    return jsonify({
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": index
                    })

                case _:
                    raise Exception(f"Method '{method}' not found")

        except KeyError as e:
            # If a key is missing in the request, return an error response
            raise Exception(f"Invalid Request: Missing key {str(e)}")

        except Exception as e:
            # Catch any unexpected errors and return a generic error
            raise Exception(str(e))
