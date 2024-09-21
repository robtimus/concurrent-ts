type LockType = "read" | "write";

interface Lock {
  type: LockType;
  callback(value: void): void;
}

export interface ReadLock {
  /**
   * Releases the read lock.
   * @throws If the read lock is no longer {@link ReadLock#isHeld | held}.
   */
  release(): void;
  /**
   * @returns `true` if this read lock is still held, or `false` otherwise.
   */
  isHeld(): boolean;
  /**
   * Upgrades the read lock to a write lock. Afterwards the read lock will no longer be {@link ReadLock#isHeld | held}.
   * @param timeout The optional maximum time to wait, in milliseconds.
   * @return A promise that's resolved when the write lock has been acquired.
   *         If multiple read locks are already held, the promise will not be resolved until all read locks are released.
   *         <p>
   *         If a timeout is given and it expires, the promise will be rejected.
   * @throws If the read lock is no longer {@link ReadLock#isHeld | held}.
   */
  upgradeToWriteLock(timeout?: number): Promise<WriteLock>;
}

export interface WriteLock {
  /**
   * Releases the write lock.
   * @throws If the write lock is no longer {@link WriteLock#isHeld | held}.
   */
  release(): void;
  /**
   * @returns `true` if this write lock is still held, or `false` otherwise.
   */
  isHeld(): boolean;
  /**
   * Downgrades the write lock to a read lock.
   * This downgrade will be effective immediately.
   * @return The acquired read lock.
   * @throws If the write lock is no longer {@link WriteLock#isHeld | held}.
   */
  downgradeToReadLock(): ReadLock;
}

export interface ReadWriteLockOptions {
  /**
   * Whether or not a read/write lock is fair; defaults to `true`.
   * A non-fair read/write lock will always acquire read locks immediately if other read locks are already held.
   * A fair read/write lock will let pending write locks take precedence over new read locks. This prevents readers from blocking writers indefinitely.
   */
  fair?: boolean;
}

export class ReadWriteLock {
  #counts: Record<LockType, number>;
  #waiting: Lock[];
  #fair: boolean;

  constructor(options?: ReadWriteLockOptions) {
    this.#counts = {
      read: 0,
      write: 0,
    };
    this.#waiting = [];
    this.#fair = options?.fair ?? true;
  }

  /**
   * Acquires a read lock.
   * @param timeout The optional maximum time to wait, in milliseconds.
   * @return A promise that's resolved with the acquired read lock.
   *         If a write lock is already held, the promise will not be resolved until the write lock is released.
   *         If other read locks are already held and there are no pending write locks, the promise is resolved immediately.
   *         Otherwise, the {@link ReadWriteLockOptions#fair | fairness} determines whether or not the promise is resolved immediately or not.
   *         <p>
   *         If a timeout is given and it expires, the promise will be rejected.
   */
  acquireReadLock(timeout?: number): Promise<ReadLock> {
    if ((this.#counts.read > 0 && !this.#fair) || (!this.isWriteLockHeld() && this.#waiting.length === 0)) {
      // non-fair with active readers, or no (pending) writes; acquire the read lock immediately
      // with a write count of 0, waiting should not contain any pending read locks
      this.#counts.read++;
      return Promise.resolve(this.#newReadLock());
    }
    return this.#acquireLock("read", timeout, () => this.#newReadLock());
  }

  #newReadLock(): ReadLock {
    return new ReadLockImpl(
      () => this.#releaseReadLock(),
      (timeout) => this.acquireWriteLock(timeout),
    );
  }

  #releaseReadLock(): void {
    if (--this.#counts.read === 0) {
      this.#activateLocks();
    }
  }

  /**
   * Acquires a write lock.
   * @param timeout The optional maximum time to wait, in milliseconds.
   * @return A promise that's resolved with the acquired write lock.
   *         If a read or write lock is already held, the promise will not be resolved until all locks are released.
   *         <p>
   *         If a timeout is given and it expires, the promise will be rejected.
   */
  acquireWriteLock(timeout?: number): Promise<WriteLock> {
    if (this.#counts.read === 0 && this.#counts.write === 0) {
      this.#counts.write++;
      return Promise.resolve(this.#newWriteLock());
    }
    return this.#acquireLock("write", timeout, () => this.#newWriteLock());
  }

  #newWriteLock(): WriteLock {
    return new WriteLockImpl(
      () => this.#releaseWriteLock(),
      () => this.#downgradeToReadLock(),
    );
  }

  #releaseWriteLock(): void {
    if (--this.#counts.write === 0) {
      this.#activateLocks();
    }
  }

  #acquireLock<T>(type: LockType, timeout: number | undefined, lockFactory: () => T): Promise<T> {
    if (timeout === undefined) {
      return new Promise<T>((resolve) => {
        this.#waiting.push({
          type: type,
          callback: () => resolve(lockFactory()),
        });
      });
    }
    if (timeout <= 0) {
      return Promise.reject("Timeout expired");
    }
    return new Promise<T>((resolve, reject) => {
      let lock: Lock | undefined = undefined;
      const timer = setTimeout(() => {
        this.#waiting = this.#waiting.filter((l) => l !== lock);
        reject("Timeout expired");
      }, timeout);
      lock = {
        type,
        callback: () => {
          clearTimeout(timer);
          resolve(lockFactory());
        },
      };
      this.#waiting.push(lock);
    });
  }

  #activateLocks() {
    // activate the first pending lock regardless of its type
    // if it's a read lock, activate other read locks as well
    const lock = this.#waiting.shift();
    let activateReadLocks = false;
    if (lock) {
      this.#counts[lock.type]++;
      lock.callback();
      activateReadLocks = lock.type === "read";
    }
    if (activateReadLocks) {
      this.#activateReadLocks();
    }
  }

  #activateReadLocks() {
    if (this.#fair) {
      // only activate read locks until the first write lock
      while (this.#waiting.length > 0 && this.#waiting[0].type === "read") {
        this.#counts.read++;
        this.#waiting.shift()!.callback();
      }
    } else {
      // activate all read locks
      const waiting = this.#waiting;
      this.#waiting = [];
      for (const lock of waiting) {
        if (lock.type === "read") {
          this.#counts.read++;
          lock.callback();
        } else {
          this.#waiting.push(lock);
        }
      }
    }
  }

  #downgradeToReadLock(): ReadLock {
    this.#counts.read++;
    this.#counts.write--;
    this.#activateReadLocks();
    return this.#newReadLock();
  }

  /**
   * @returns `true` if at least one read lock is held, or `false` otherwise.
   */
  isReadLockHeld(): boolean {
    return this.#counts.read > 0;
  }

  /**
   * @returns `true` if a write lock is held, or `false` otherwise.
   */
  isWriteLockHeld(): boolean {
    return this.#counts.write > 0;
  }

  /**
   * @returns The number of currently held read locks.
   */
  currentReadCount(): number {
    return this.#counts.read;
  }

  /**
   * @returns The number of promises returned by {@link ReadWriteLock#acquireReadLock | acquireReadLock} that have not yet been resolved.
   */
  waitingReadCount(): number {
    return this.#waitingCount("read");
  }

  /**
   * @returns The number of promises returned by {@link ReadWriteLock#acquireWriteLock | acquireWriteLock} or {@link ReadLock#upgradeToWriteLock} that have not yet been resolved.
   */
  waitingWriteCount(): number {
    return this.#waitingCount("write");
  }

  #waitingCount(type: LockType): number {
    return this.#waiting.filter((lock) => lock.type === type).length;
  }

  toString(): string {
    return `ReadWriteLock[write lock=${this.isWriteLockHeld()}, read locks=${this.currentReadCount()}]`;
  }
}

class ReadLockImpl implements ReadLock {
  #held: boolean;
  #release: () => void;
  #acquireWriteLock: (timeout?: number) => Promise<WriteLock>;

  constructor(release: () => void, acquireWriteLock: (timeout?: number) => Promise<WriteLock>) {
    this.#held = true;
    this.#release = release;
    this.#acquireWriteLock = acquireWriteLock;
  }

  release(): void {
    this.#verifyHeld();
    this.#release();
    this.#held = false;
  }

  isHeld(): boolean {
    return this.#held;
  }

  upgradeToWriteLock(timeout?: number): Promise<WriteLock> {
    this.release();
    return this.#acquireWriteLock(timeout);
  }

  #verifyHeld() {
    if (!this.#held) {
      throw new Error("Read lock is no longer held");
    }
  }

  toString() {
    return `ReadLock[held=${this.#held}]`;
  }
}

class WriteLockImpl implements WriteLock {
  #held: boolean;
  #release: () => void;
  #downGradeToReadLock: () => ReadLock;

  constructor(release: () => void, downGradeToReadLock: () => ReadLock) {
    this.#held = true;
    this.#release = release;
    this.#downGradeToReadLock = downGradeToReadLock;
  }

  release(): void {
    this.#verifyHeld();
    this.#release();
    this.#held = false;
  }

  isHeld(): boolean {
    return this.#held;
  }

  downgradeToReadLock(): ReadLock {
    this.#verifyHeld();
    const result = this.#downGradeToReadLock();
    this.#held = false;
    return result;
  }

  #verifyHeld() {
    if (!this.#held) {
      throw new Error("Write lock is no longer held");
    }
  }

  toString() {
    return `WriteLock[held=${this.#held}]`;
  }
}

Object.freeze(ReadWriteLock.prototype);
Object.freeze(ReadLockImpl.prototype);
Object.freeze(WriteLockImpl.prototype);
