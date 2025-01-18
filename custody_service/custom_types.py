from enum import Enum
from typing import TypedDict, Literal

CurveType = Literal["ed25519", "secp256k1"]
ZellulatTxType = Literal["AgentRegister", "CreateDepositAddress", "Deposit", "AddWithdraw", "ApproveWithdraw", "TransferWithdraw"]


class ChainId(Enum):
    Solana = "SOL"
    Ton = "TON"
    

class AvailableTokenInfo(TypedDict):
    symbol: str
    name: int
    contract: str
    decimals: int


class ZellularDepositeToken(TypedDict):
    token: str
    contract: str
    amount: int
    decimals: int


class ZellularDepositTx(TypedDict):
    chain: ChainId
    block: int
    txHash: str
    agent: str
    account: int
    user: int
    address: str
    deposit: ZellularDepositeToken
    confirmed: bool


class ZellularRegisterTx(TypedDict):
    signers: list[str]
    threshold: int


class ZellularCreateDepositAddressTx(TypedDict):
    agent: str
    chain: ChainId
    user: int
    address: str
    active: bool


class ZellularAddWithdrawTx(TypedDict):
    id: str
    agent: str
    signatures: list[str]
    token: AvailableTokenInfo
    targetChain: str
    amount: int
    toAddress: str


class ZellularWithdrawTx(TypedDict):
    owner: str


class ZellularTx(TypedDict):
    type: ZellulatTxType
    data: ZellularRegisterTx | ZellularCreateDepositAddressTx | ZellularDepositTx | ZellularWithdrawTx
