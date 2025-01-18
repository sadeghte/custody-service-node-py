import redis, json, asyncio, urllib, time

class Zellular:
    def __init__(self, app_name, base_url, threshold_percent=67):
        self.app_name = app_name
        self.base_url = base_url
        self.threshold_percent = threshold_percent
        url = urllib.parse.urlparse(base_url)
        self.r = redis.Redis(host=url.hostname, port=url.port, db=0)

    def batches(self, after=0):
        assert after >= 0, "after should be equal or bigger than 0"
        while True:
            batches = self.r.lrange(self.app_name, after, after + 100)
            for batch in batches:
                print(batch)
                after += 1
                yield batch, after
            time.sleep(0.1)

    def get_last_finalized(self):
        return { "index": self.r.llen(self.app_name) }

    def send(self, batch, blocking=False):
        if blocking:
            index = self.get_last_finalized()["index"]

        self.r.rpush(self.app_name, json.dumps(batch))

        if not blocking:
            return

        for received_batch, index in self.batches(after=index):
            received_batch = json.loads(received_batch)
            if batch == received_batch:
                return index


if __name__ == "__main__":
    verifier = Zellular("simple_app", "http://localhost:6379")
    for batch, index in verifier.batches():
        txs = json.loads(batch)
        for i, tx in enumerate(txs):
            print(index, i, tx)
