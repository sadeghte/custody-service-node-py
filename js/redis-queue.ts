import { createClient, RedisClientType } from 'redis';

export class RedisQueue {
    private client: RedisClientType;
    public queueName: string;

    constructor(queueName: string, redisUrl: string = 'redis://0.0.0.0:6379') {
        this.queueName = queueName;
        this.client = createClient({ url: redisUrl });

        this.client.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });

        this.client.connect();
    }

    /**
     * Add an item to the Redis queue.
     * @param item The item to add to the queue.
     */
    async push(item: string): Promise<void> {
        try {
            await this.client.rPush(this.queueName, item);
            // console.log(`Item added to queue "${this.queueName}":`, item);
        } catch (error) {
            console.error('Error adding item to queue:', error);
        }
    }

    async length(): Promise<number> {
        return await this.client.lLen(this.queueName);
    }

    /**
     * Read an item from the Redis queue (blocking read).
     * @returns The item from the queue.
     */
    async pop(): Promise<string | null> {
        try {
            const result = await this.client.blPop(this.queueName, 0); // Blocking pop
            if (result) {
                // console.log(`Item read from queue "${this.queueName}":`, result.element);
                return result.element;
            }
            return null;
        } catch (error) {
            console.error('Error reading item from queue:', error);
            return null;
        }
    }

    /**
     * Disconnect the Redis client.
     */
    async disconnect(): Promise<void> {
        await this.client.disconnect();
    }
}
