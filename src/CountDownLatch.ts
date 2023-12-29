import { resolveOnTimeout } from "completion-stage";

export class CountDownLatch {
  #count: number;
  #waiting: ((value: void) => void)[];

  constructor(count: number) {
    if (count < 0) {
      throw new Error(`${count} < 0`);
    }
    this.#count = count;
    this.#waiting = [];
  }

  wait(): Promise<void>;
  wait(timeout: number): Promise<boolean>;
  wait(timeout?: number): Promise<void | boolean> {
    if (this.#count === 0) {
      return timeout === undefined ? Promise.resolve() : Promise.resolve(true);
    }
    const promise = new Promise<void>((resolve) => this.#waiting.push(resolve));
    if (timeout === undefined) {
      return promise;
    }
    return resolveOnTimeout(
      promise.then(() => true),
      false,
      timeout,
    );
  }

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

  getCount(): number {
    return this.#count;
  }

  toString(): string {
    return `CountDownLatch[count=${this.#count}]`;
  }
}
