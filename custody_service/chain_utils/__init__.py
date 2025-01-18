from . import solana_chain_observer

all_observers = {
    "SOL": solana_chain_observer
}

__all__ = ["all_observers"]