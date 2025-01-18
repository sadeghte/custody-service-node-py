
import cluster from 'node:cluster';
import process from 'node:process';

export class ClusterManager<WorkerType> {
    private workers: Record<number, { id: number, type: WorkerType }> = {}

    constructor() {
        // Handle termination signals
        process.on('SIGINT', this.cleanup.bind(this));
        process.on('SIGTERM', this.cleanup.bind(this));
    }

    static get isPrimary() {
        return cluster.isPrimary
    }

    start(workerTypes: WorkerType[]) {
        console.log(`cluster manager started with PID: ${process.pid}`);

        // Spawn processor workers
        for (let i = 0; i < workerTypes.length; i++) {
            this.spawnWorker(i + 1, workerTypes[i]);
        }

        // Restart workers if they exit unexpectedly
        // @ts-ignore
        cluster.on('exit', (worker, code, signal) => {
            const { pid } = worker.process
            const info = this.workers[pid];
            console.log(`Worker ${info.id} exited with code: ${code}, signal: ${signal}`);
            if (signal !== 'SIGTERM') {
                console.log(`Restarting worker ${info.id}`);
                this.spawnWorker(info.id, info.type); // Restart with the same ID
            }
        });
    }

    private spawnWorker(id: number, type: WorkerType) {
        // @ts-ignore
        const worker = cluster.fork({ WORKER_ID: id.toString(), WORKER_TYPE: type });
        this.workers[worker.process.pid] = { id, type }
        console.log(`Spawned worker ${id} with PID: ${worker.process.pid}`);
    }

    private cleanup() {
        console.log(`Cleaning up ${Object.keys(cluster.workers).length} workers...`);
        // @ts-ignore
        for (const worker of Object.values(cluster.workers)) {
            // @ts-ignore
            console.log(`Terminating worker with ID: ${worker?.id}, PID: ${worker?.process.pid}`);
            // @ts-ignore
            worker?.process.kill('SIGTERM');
        }

        console.log("terminating cluster manager...")
        process.exit();
    }
}