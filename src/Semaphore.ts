interface Acquirer {
  permitsNeeded: number;
  callback(value: void): void;
}

export interface TryAcquireSemaphoreOptions {
  /** The number of permits to acquire; defaults to 1. */
  permits?: number;
  /** The maximum time to wait, in milliseconds. */
  timeout: number;
}

export class Semaphore {
  #permits: number;
  #waiting: Acquirer[];

  /**
   * @param permits The number of initial permits.
   * @throws If the given number of permits is negative.
   */
  constructor(permits: number) {
    if (permits < 0) {
      throw new Error(`${permits} < 0`);
    }
    this.#permits = permits;
    this.#waiting = [];
  }

  /**
   * Acquires a number of permits, waiting until enough permits are available.
   * @param permits The number of permits to acquire.
   * @return A promise that isn't resolved until the requested number of permits is available.
   *         <p>
   *         The promise will never be rejected.
   * @throws If the given number of permits is negative.
   */
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

  /**
   * Acquires a single permit if one is available.
   * @return `true` if at least one permit is available, or `false` otherwise.
   */
  tryAcquire(): boolean;
  /**
   * Acquires a number permit if enough are available.
   * @param permits The number of permits to acquire.
   * @return `true` if enough permits are available, or `false` otherwise.
   * @throws If the given number of permits is negative.
   */
  tryAcquire(permits: number): boolean;
  /**
   * Tries to acquire a number of permits, waiting until enough are available.
   * @param options The options used to acquire permits.
   * @return A promise that isn't resolved until enough permits are available or the given timeout expires, whichever occurs first.
   *         If enough permits become available before the timeout expires, the promise will be resolved with `true`.
   *         If the timeout expires or is not positive, the promise will be resolved with `false`.
   *         If the timeout is not positive, the promise will be resolved immediately.
   *         <p>
   *         The promise will never be rejected.
   * @throws If the given options specifies a negative number of permits.
   */
  tryAcquire(options: TryAcquireSemaphoreOptions): Promise<boolean>;
  tryAcquire(permitsOrOptions?: number | TryAcquireSemaphoreOptions): boolean | Promise<boolean> {
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

  /**
   * Releases a number of permits.
   * @param permits The number of permits to release.
   * @throws If the given number of permits is negative.
   */
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

  /**
   * @returns The available number of permits; never negative.
   */
  availablePermits(): number {
    return this.#permits;
  }

  /**
   * Drains the number of permits. Afterwards, `availablePermits()` will return 0.
   * @returns The number of available permits before this method was called.
   */
  drainPermits(): number {
    const permits = this.#permits;
    this.#permits = 0;
    return permits;
  }

  /**
   * @returns `true` if at least one promise returned by one of the `acquire` or `tryAcquire` methods has not yet been resolved, or `false` otherwise.
   */
  hasWaitingAcquirers(): boolean {
    return this.#waiting.length > 0;
  }

  /**
   * @returns The number of promises returned by one of the `acquire` or `tryAcquire` methods that have not yet been resolved.
   */
  waitingAcquirerCount(): number {
    return this.#waiting.length;
  }

  toString(): string {
    return `Semaphore[permits=${this.#permits}]`;
  }
}

Object.freeze(Semaphore.prototype);
