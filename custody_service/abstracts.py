from pyfrost.network.abstract import Validators, DataManager, NodesInfo as BaseNodeInfo
from .configs import VALID_IPS, generate_privates_and_nodes_info
from custody_service import database
from custody_service.chain_utils import solana_chain_utils, ton_chain_utils
import hashlib
import json


class NodeDataManager(DataManager):
    def __init__(self) -> None:
        super().__init__()
        self.__dkg_keys = {}
        self.__nonces = {}

    def set_nonce(self, nonce_public: str, nonce_private: str) -> None:
        self.__nonces[nonce_public] = nonce_private

    def get_nonce(self, nonce_public: str):
        return self.__nonces[nonce_public]

    def remove_nonce(self, nonce_public: str) -> None:
        del self.__nonces[nonce_public]

    def set_key(self, key, value) -> None:
        database.insert_dist_key(id=key, key=value)
        self.__dkg_keys[key] = value

    def get_key(self, key):
        if key not in self.__dkg_keys:
            value = database.get_dist_key(key)
            if value is not None:
                self.__dkg_keys[key] = value
        return self.__dkg_keys.get(key, {})

    def remove_key(self, key):
        del self.__dkg_keys[key]


class NodeValidators(Validators):
    def __init__(self) -> None:
        super().__init__()

    @staticmethod
    def caller_validator(sender_ip: str, method: str):
        return True

    @staticmethod
    def data_validator(request: dict):
        print("New signature request arrived: ", json.dumps(request, indent=2))
        type = request["type"]
        data = request["data"] if "data" in request else None
        match type:
            case "WithdrawConfirm":
                withdraw = database.find_withdraw(data["withdraw"])
                if withdraw is None:
                    raise Exception(f"Withdraw {data[withdraw]} not found.")
                
                result = {"request": request}
                match withdraw["targetChain"]:
                    case "SOL":
                        hash_hex = solana_chain_utils.hash_withdraw(withdraw)
                    case "TON":
                        hash_hex = ton_chain_utils.hash_withdraw(withdraw)
                result["hash"] = hash_hex
                return result
            case _:
                raise Exception("Unknown request type")


class NodesInfo(BaseNodeInfo):
    prefix = "/pyfrost"

    def __init__(self):
        _, self.nodes = generate_privates_and_nodes_info()

    def lookup_node(self, node_id: str = None):
        return self.nodes.get(node_id, {})

    def get_all_nodes(self, n: int = None) -> dict:
        if n is None:
            n = len(self.nodes)
        return list(self.nodes.keys())[:n]
