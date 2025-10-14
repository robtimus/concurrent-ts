export class CountDownLatch {
  readonly #initialCount: number;
  #count: number;
  #waiting: ((value: void) => void)[];

  /**
   * @param count The number of times `countDown` must be invoked before promises returned by `await` are resolved.
   */
  constructor(count: number) {
    if (count < 0) {
      throw new Error(`${count} < 0`);
    }
    this.#initialCount = count;
    this.#count = count;
    this.#waiting = [];
  }

  /**
   * Waits until the count reaches zero.
   * @param timeout The optional maximum time to wait, in milliseconds.
   * @return A promise that isn't resolved until the count reaches zero.
   *         <p>
   *         If a timeout is given and it expires, the promise will be rejected.
   */
  await(timeout?: number): Promise<void> {
    if (this.#count === 0) {
      return Promise.resolve();
    }
    if (timeout === undefined) {
      return new Promise<void>((resolve) => this.#waiting.push(resolve));
    }
    if (timeout <= 0) {
      return Promise.reject(new Error("Timeout expired"));
    }
    return new Promise<void>((resolve, reject) => {
      let callback: ((value: void) => void) | undefined = undefined;
      const timer = setTimeout(() => {
        this.#waiting = this.#waiting.filter((cb) => cb !== callback);
        reject(new Error("Timeout expired"));
      }, timeout);
      callback = () => {
        clearTimeout(timer);
        resolve();
      };
      this.#waiting.push(callback);
    });
  }

  /**
   * Decreases the count by one. If the count reaches zero, all promises returned by the `await` methods will be resolved.
   * If the count was already zero nothing happens.
   */
  countDown(): void {
    if (this.#count > 0) {
      this.#count--;
      if (this.#count === 0) {
        const waiting = this.#waiting;
        this.#waiting = [];
        for (const resolve of waiting) {
          resolve();
        }
      }
    }
  }

  /**
   * @returns The initial count.
   */
  initialCount(): number {
    return this.#initialCount;
  }

  /**
   * @returns The current count; never negative.
   */
  currentCount(): number {
    return this.#count;
  }

  toString(): string {
    return `CountDownLatch[count=${this.#count}]`;
  }
}

Object.freeze(CountDownLatch.prototype);
