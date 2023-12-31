export class CountDownLatch {
  readonly #initialCount: number;
  #count: number;
  #waiting: ((value: void) => void)[];

  /**
   * @param count The number of times `countDown` must be invoked before promises returned by `wait` are resolved.
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
   * @return A promise that isn't resolved until the count reaches zero.
   */
  wait(): Promise<void>;
  /**
   * Waits until the count reaches zero.
   * @param timeout The maximum time to wait, in milliseconds.
   * @return A promise that isn't resolved until the count reaches zero or the given timeout expires, whichever occurs first.
   *         If the count reaches zero before the timeout expires, the promise will be resolved with `true`.
   *         If the timeout expires, the promise will be resolved with `false`.
   *         If the timeout is not positive, the promise will be resolved immediately.
   *         <p>
   *         The promise will never be rejected.
   */
  wait(timeout: number): Promise<boolean>;
  wait(timeout?: number): Promise<void | boolean> {
    if (this.#count === 0) {
      return timeout === undefined ? Promise.resolve() : Promise.resolve(true);
    }
    if (timeout === undefined) {
      return new Promise<void>((resolve) => this.#waiting.push(resolve));
    }
    if (timeout <= 0) {
      return Promise.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      let callback: ((value: void) => void) | undefined = undefined;
      const timer = setTimeout(() => {
        this.#waiting = this.#waiting.filter((cb) => cb !== callback);
        resolve(false);
      }, timeout);
      callback = () => {
        clearTimeout(timer);
        resolve(true);
      };
      this.#waiting.push(callback);
    });
  }

  /**
   * Decreases the count by one. If the count reaches zero, all promises returned by the wait methods will be resolved.
   * If the count was already zero nothing happens.
   */
  countDown(): void {
    if (this.#count > 0) {
      this.#count--;
      if (this.#count === 0) {
        const waiting = this.#waiting;
        this.#waiting = [];
        waiting.forEach((resolve) => resolve());
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
