import { Worker } from 'worker_threads';
import { cpus } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WorkerPool {
  private workers: Worker[] = [];
  private queue: { task: any; resolve: Function; reject: Function }[] = [];
  private activeWorkers = 0;
  private maxWorkers: number;

  constructor(workerScript: string, maxWorkers = cpus().length - 1) {
    this.maxWorkers = Math.max(1, maxWorkers);
    for (let i = 0; i < this.maxWorkers; i++) {
      this.workers.push(new Worker(workerScript));
    }

    this.workers.forEach((worker, index) => {
      worker.on('message', (result) => {
        this.activeWorkers--;
        const task = this.queue.shift();
        if (task) {
          task.resolve(result);
        }
        this.processQueue();
      });

      worker.on('error', (error) => {
        this.activeWorkers--;
        const task = this.queue.shift();
        if (task) {
          task.reject(error);
        }
        this.processQueue();
      });
    });
  }

  runTask(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task: data, resolve, reject });
      this.processQueue();
    });
  }

  private processQueue() {
    if (this.queue.length === 0 || this.activeWorkers >= this.maxWorkers) {
      return;
    }

    const { task } = this.queue[0];
    const worker = this.workers[this.activeWorkers % this.maxWorkers];
    this.activeWorkers++;
    worker.postMessage(task);
  }

  terminate() {
    return Promise.all(this.workers.map(worker => worker.terminate()));
  }
}

// Create worker pools for different CPU-intensive tasks
export const docxWorkerPool = new WorkerPool(
  path.resolve(__dirname, 'workers/docx-worker.js'),
  Math.max(1, cpus().length - 1)
);