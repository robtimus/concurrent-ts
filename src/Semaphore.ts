interface Caller {
  permitsNeeded: number;
  callback(value: void): void;
}

export interface TryAcquireOptions {
  permits?: number;
  timeout: number;
}

export class Semaphore {
  #permits: number;
  #waiting: Caller[];

  constructor(permits: number) {
    if (permits < 0) {
      throw new Error(`${permits} < 0`);
    }
    this.#permits = permits;
    this.#waiting = [];
  }

  acquire(permits = 1): Promise<void> {
    if (permits < 0) {
      throw new Error(`${permits} < 0`);
    }
    if (this.#permits >= permits) {
      this.#permits -= permits;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.#waiting.push({
        permitsNeeded: permits,
        callback: resolve,
      });
    });
  }

  tryAcquire(): Promise<boolean>;
  tryAcquire(permits: number): Promise<boolean>;
  tryAcquire(options: TryAcquireOptions): Promise<boolean>;
  tryAcquire(permitsOrOptions?: number | TryAcquireOptions): Promise<boolean> {
    let permits = 1;
    let timeout: number | undefined;
    if (typeof permitsOrOptions === "number") {
      permits = permitsOrOptions;
    } else if (permitsOrOptions) {
      permits = permitsOrOptions.permits ?? 1;
      timeout = permitsOrOptions.timeout;
    }

    if (this.#permits >= permits) {
      this.#permits -= permits;
      return Promise.resolve(true);
    }
    if (timeout === undefined || timeout <= 0) {
      return Promise.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      let caller: Caller | undefined = undefined;
      const timer = setTimeout(() => {
        this.#waiting = this.#waiting.filter((c) => c !== caller);
        resolve(false);
      }, timeout);
      caller = {
        permitsNeeded: permits,
        callback: () => {
          clearTimeout(timer);
          resolve(true);
        },
      };
      this.#waiting.push(caller);
    });
  }

  release(permits = 1): void {
    if (permits < 0) {
      throw new Error(`${permits} < 0`);
    }
    this.#permits += permits;

    const waiting = this.#waiting;
    this.#waiting = [];
    for (const caller of waiting) {
      if (this.#permits >= caller.permitsNeeded) {
        this.#permits -= caller.permitsNeeded;
        caller.callback();
      } else {
        this.#waiting.push(caller);
      }
    }
  }

  availablePermits(): number {
    return this.#permits;
  }

  drainPermits(): number {
    const permits = this.#permits;
    this.#permits = 0;
    return permits;
  }

  hasWaitingCallers(): boolean {
    return this.#waiting.length > 0;
  }

  waitingCallerCount(): number {
    return this.#waiting.length;
  }

  toString(): string {
    return `Semaphore[permits=${this.#permits}]`;
  }
}
