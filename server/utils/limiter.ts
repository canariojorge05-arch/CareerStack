export class Limiter {
  private current = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly concurrency: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.current >= this.concurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.current++;
    try {
      const result = await task();
      return result;
    } finally {
      this.current--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}
