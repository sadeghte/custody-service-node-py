import os, time, asyncio,logging,sys
from flask import Flask
from flask_cors import CORS
from pyfrost.network.node import Node as FrostNode
from custody_service.abstracts import NodesInfo, NodeDataManager, NodeValidators
from custody_service.configs import generate_privates_and_nodes_info, num_to_hex
from custody_service.jsonrpc_handler import JsonRpcHandler


def init_logs(file_path: str):
    node_number = int(os.getenv("NODE_ID"))
    file_name = f"node{node_number}.log"
    log_formatter = logging.Formatter(
        "%(asctime)s - %(message)s",
    )
    root_logger = logging.getLogger()
    if not os.path.exists(file_path):
        os.mkdir(file_path)
    with open(f"{file_path}/{file_name}", "w"):
        pass
    file_handler = logging.FileHandler(f"{file_path}/{file_name}")
    file_handler.setFormatter(log_formatter)
    root_logger.addHandler(file_handler)
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(log_formatter)
    root_logger.addHandler(console_handler)
    root_logger.setLevel(logging.DEBUG)
    sys.set_int_max_str_digits(0)


def run_node() -> None:
    init_logs("node-logs");
    print("node ....")
    node_number = int(os.getenv("NODE_ID"))
    data_manager = NodeDataManager()
    nodes_info = NodesInfo()
    privates, _ = generate_privates_and_nodes_info()
    node_id = num_to_hex(node_number)
    frost_node = FrostNode(
        data_manager,
        node_id,
        privates[node_number - 1],
        nodes_info,
        NodeValidators.caller_validator,
        NodeValidators.data_validator,
    )
    jsonrpc = JsonRpcHandler(
        data_manager,
        node_id,
        privates[node_number - 1],
        nodes_info,
        NodeValidators.caller_validator,
        NodeValidators.data_validator,
    )
    node_info = nodes_info.lookup_node(node_id)
    app = Flask(__name__)
    app.register_blueprint(frost_node.blueprint, url_prefix="/pyfrost")
    app.register_blueprint(jsonrpc.blueprint, url_prefix="/jsonrpc")
    app.run(host="0.0.0.0", port=int(node_info["port"]), debug=True)


if __name__ == "__main__":

    try:
        run_node()
    except KeyboardInterrupt:
        pass
