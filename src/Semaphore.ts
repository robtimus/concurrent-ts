interface Acquirer {
  permitsNeeded: number;
  callback(value: void): void;
}

export interface TryAcquireOptions {
  permits?: number;
  timeout: number;
}

export class Semaphore {
  #permits: number;
  #waiting: Acquirer[];

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

  tryAcquire(): boolean;
  tryAcquire(permits: number): boolean;
  tryAcquire(options: TryAcquireOptions): Promise<boolean>;
  tryAcquire(permitsOrOptions?: number | TryAcquireOptions): boolean | Promise<boolean> {
    if (typeof permitsOrOptions !== "object") {
      // tryAcquire() or tryAcquire(permits)

      const permits = permitsOrOptions ?? 1;
      if (permits < 0) {
        throw new Error(`${permits} < 0`);
      }
      if (this.#permits >= permits) {
        this.#permits -= permits;
        return true;
      }
      return false;
    }

    // tryAcquire(options)

    const permits = permitsOrOptions.permits ?? 1;
    const timeout = permitsOrOptions.timeout;
    if (permits < 0) {
      throw new Error(`${permits} < 0`);
    }
    if (this.#permits >= permits) {
      this.#permits -= permits;
      return Promise.resolve(true);
    }
    if (timeout <= 0) {
      return Promise.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      let acquirer: Acquirer | undefined = undefined;
      const timer = setTimeout(() => {
        this.#waiting = this.#waiting.filter((c) => c !== acquirer);
        resolve(false);
      }, timeout);
      acquirer = {
        permitsNeeded: permits,
        callback: () => {
          clearTimeout(timer);
          resolve(true);
        },
      };
      this.#waiting.push(acquirer);
    });
  }

  release(permits = 1): void {
    if (permits < 0) {
      throw new Error(`${permits} < 0`);
    }
    this.#permits += permits;

    const waiting = this.#waiting;
    this.#waiting = [];
    for (const acquirer of waiting) {
      if (this.#permits >= acquirer.permitsNeeded) {
        this.#permits -= acquirer.permitsNeeded;
        acquirer.callback();
      } else {
        this.#waiting.push(acquirer);
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

  hasWaitingAcquirers(): boolean {
    return this.#waiting.length > 0;
  }

  waitingAcquirerCount(): number {
    return this.#waiting.length;
  }

  toString(): string {
    return `Semaphore[permits=${this.#permits}]`;
  }
}
