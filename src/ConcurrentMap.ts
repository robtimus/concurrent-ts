type Callback = () => void;

/**
 * @template K The key type.
 * @template V The value type.
 */
export class ConcurrentMap<K, V> {
  #current: Map<K, V>;
  #pending: Map<K, Callback[]>;

  /**
   * @param entries Initial entries for the map.
   * @template K The key type.
   * @template V The value type.
   */
  constructor(entries?: readonly (readonly [K, V])[]) {
    this.#current = new Map(entries);
    this.#pending = new Map<K, Callback[]>();
  }

  /**
   * @return The number of entries currently in the map.
   *         This is a snapshot; the results of any pending actions will not be visible yet.
   */
  get size(): number {
    return this.#current.size;
  }

  /**
   * Returns the value for a key, if available.
   * @param key The key to return the value for.
   * @return The value for the key, or `undefined` if there is no entry for the given key.
   *         This is a snapshot; the results of any pending actions will not be visible yet.
   */
  get(key: K): V | undefined {
    return this.#current.get(key);
  }

  /**
   * Returns the value for a key, if available.
   * @param key The key to return the value for.
   * @return A promise that will be resolved with the value for the key, or `undefined` if there is no entry for the key.
   *         <p>
   *         If there are any pending actions for the key the returned promise will not be resolved until they have all finished.
   *         The promise will never be rejected.
   */
  getLatest(key: K): Promise<V | undefined> {
    return this.#result(key, () => this.get(key));
  }

  /**
   * Checks whether there is an entry for a key.
   * @param key The key to check.
   * @return `true` if there is an entry for the key, or `false` otherwise.
   *         This is a snapshot; the results of any pending actions will not be visible yet.
   */
  has(key: K): boolean {
    return this.#current.has(key);
  }

  /**
   * Sets the value for a key.
   * @param key The key to set the value for.
   * @param value The value to set.
   * @return A promise that will be resolved with the previous value for the key, or `undefined` if there was no entry for the key.
   *         <p>
   *         If there are any pending actions for the key the returned promise will not be resolved until they have all finished.
   *         The promise will never be rejected.
   */
  set(key: K, value: NonNullable<V>): Promise<V | undefined> {
    return this.#result(key, () => {
      const oldValue = this.get(key);
      this.#current.set(key, value);
      return oldValue;
    });
  }

  /**
   * Deletes the entry for a key.
   * @param key The key to delete the entry for.
   * @return A promise that will be resolved with the previous value for the key, or `undefined` if there was no entry for the key.
   *         <p>
   *         If there are any pending actions for the key the returned promise will not be resolved until they have all finished.
   *         The promise will never be rejected.
   */
  delete(key: K): Promise<V | undefined>;
  /**
   * Deletes the entry for a key only if it's currently mapped to a given value.
   * @param key The key to delete the entry for.
   * @param value The value for the key.
   * @return A promise that will be resolved with `true` if the entry was deleted, or `false` otherwise.
   *         <p>
   *         If there are any pending actions for the key the returned promise will not be resolved until they have all finished.
   *         The promise will never be rejected.
   */
  delete(key: K, value: NonNullable<V>): Promise<boolean>;
  delete(key: K, value?: V): Promise<V | undefined | boolean> {
    return this.#result(key, () => {
      const oldValue = this.#current.get(key);
      if (value === undefined) {
        this.#current.delete(key);
        return oldValue;
      }
      return value === oldValue && this.#current.delete(key);
    });
  }

  /**
   * Deletes all entries.
   * If there are no pending actions for a key its entry will be deleted immediately. Otherwise its entry will only be deleted until all pending actions have finished.
   * @return A promise that will be resolved once every entry has been deleted.
   *         <p>
   *         The promise will not be resolved until all current entries have been removed once; at that time new entries may have been added though.
   *         The promise will never be rejected.
   */
  async clear(): Promise<void> {
    for (const entry of this.#current) {
      const key = entry[0];
      const pending = this.#pending.get(key);
      if (pending === undefined) {
        this.#current.delete(key);
      }
    }
    const promises: Promise<unknown>[] = [];
    this.#pending.forEach((p, k) => {
      promises.push(
        new Promise<void>((resolve) => {
          p.push(() => {
            this.#current.delete(k);
            resolve();
            this.#triggerNextPending(k);
          });
        }),
      );
    });
    await Promise.all(promises);
  }

  /**
   * Returns an iterator over the keys in the map.
   * @return A new iterator over the keys in the map.
   *         This is a snapshot; the results of any pending actions will not be visible yet.
   */
  keys(): IterableIterator<K> {
    return this.#current.keys();
  }

  /**
   * Returns an iterator over the values in the map.
   * @return A new iterator over the values in the map.
   *         This is a snapshot; the results of any pending actions will not be visible yet.
   */
  values(): IterableIterator<V> {
    return this.#current.values();
  }

  /**
   * Returns an iterator over the entries in the map.
   * @return A new iterator over the entries in the map.
   *         This is a snapshot; the results of any pending actions will not be visible yet.
   */
  entries(): IterableIterator<[K, V]> {
    return this.#current.entries();
  }

  /**
   * Returns an iterator over the entries in the map.
   * @return A new iterator over the entries in the map.
   *         This is a snapshot; the results of any pending actions will not be visible yet.
   */
  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.#current[Symbol.iterator]();
  }

  /**
   * Sets the value for a key only if there is no entry for the key yet.
   * @param key The key to set the value for.
   * @param value The value to set.
   * @return A promise that will be resolved with the previous value for the key, or `undefined` if there was no entry for the key.
   *         <p>
   *         If there are any pending actions for the key the returned promise will not be resolved until they have all finished.
   *         The promise will never be rejected.
   */
  setIfAbsent(key: K, value: NonNullable<V>): Promise<V | undefined> {
    return this.#result(key, () => {
      const oldValue = this.#current.get(key);
      if (oldValue === undefined) {
        this.#current.set(key, value);
      }
      return oldValue;
    });
  }

  /**
   * Sets the value for a key only if there is an entry for the key already.
   * This is similar to {@link replace}, except this method will replace any existing value.
   * @param key The key to set the value for.
   * @param value The value to set.
   * @return A promise that will be resolved with the previous value for the key, or `undefined` if there was no entry for the key.
   *         <p>
   *         If there are any pending actions for the key the returned promise will not be resolved until they have all finished.
   *         The promise will never be rejected.
   */
  setIfPresent(key: K, value: NonNullable<V>): Promise<V | undefined> {
    return this.#result(key, () => {
      const oldValue = this.#current.get(key);
      if (oldValue !== undefined) {
        this.#current.set(key, value);
      }
      return oldValue;
    });
  }

  /**
   * Sets the value for a key only if it is currently mapped to a given value.
   * This is similar to {@link setIfPresent}, except this method will only replace the given value.
   * @param key The key to set the value for.
   * @param oldValue The value to replace.
   * @param newValue The new value to set.
   * @return A promise that will be resolved with `true` if the key was previously mapped to the given value, or `false` otherwise.
   *         <p>
   *         If there are any pending actions for the key the returned promise will not be resolved until they have all finished.
   *         The promise will never be rejected.
   */
  replace(key: K, oldValue: NonNullable<V>, newValue: NonNullable<V>): Promise<boolean> {
    return this.#result(key, () => {
      if (oldValue === this.#current.get(key)) {
        this.#current.set(key, newValue);
        return true;
      }
      return false;
    });
  }

  /**
   * Computes the value for a key only if there is no entry for the key yet.
   * The new value will be the return value of calling the given function.
   * If the given function throws an error, the error is propagated through the returned promise and no value is set.
   * @param key The key to compute the value for.
   * @param fn The function to compute the value. Its input will be the key.
   * @return A promise that will be resolved with the new value for the key.
   *         <p>
   *         If there are any pending actions for the key the returned promise will not be resolved until they have all finished.
   *         The promise will be rejected if the given function throws an error.
   */
  computeIfAbsent(key: K, fn: (k: K) => V | PromiseLike<V>): Promise<V>;
  /**
   * Computes the value for a key only if there is no entry for the key yet.
   * The new value will be the return value of calling the given function. However, if the given function returns `undefined`, no value is set.
   * If the given function throws an error, the error is propagated through the returned promise and no value is set.
   * @param key The key to compute the value for.
   * @param fn The function to compute the value. Its input will be the key.
   * @return A promise that will be resolved with the new value for the key, or `undefined` if the given function returns `undefined`.
   *         <p>
   *         If there are any pending actions for the key the returned promise will not be resolved until they have all finished.
   *         The promise will be rejected if the given function throws an error.
   */
  computeIfAbsent(key: K, fn: (k: K) => V | undefined | PromiseLike<V | undefined>): Promise<V | undefined>;
  computeIfAbsent(key: K, fn: (k: K) => V | undefined | PromiseLike<V | undefined>): Promise<V | undefined> {
    const pending = this.#pending.get(key);
    if (pending === undefined) {
      const oldValue = this.#current.get(key);
      if (oldValue !== undefined) {
        return Promise.resolve(oldValue);
      }
      this.#pending.set(key, []);
      return new Promise((resolve, reject) => {
        this.#computeWhenAbsent(key, fn, resolve, reject);
      });
    }
    return new Promise((resolve, reject) => {
      pending.push(() => {
        const oldValue = this.#current.get(key);
        if (oldValue !== undefined) {
          resolve(oldValue);
          this.#triggerNextPending(key);
        } else {
          this.#computeWhenAbsent(key, fn, resolve, reject);
        }
      });
    });
  }

  #computeWhenAbsent(key: K, fn: (k: K) => V | undefined | PromiseLike<V | undefined>, resolve: (v?: V) => void, reject: (reason: unknown) => void): void {
    Promise.resolve(key)
      .then(fn)
      .then((v) => {
        if (v !== undefined) {
          this.#current.set(key, v);
        }
        resolve(v);
      })
      .catch(reject)
      .finally(() => this.#triggerNextPending(key));
  }

  /**
   * Computes the value for a key only if there is entry for the key already.
   * The new value will be the return value of calling the given function. However, if the given function returns `undefined`, the entry is removed instead.
   * If the given function throws an error, the error is propagated through the returned promise and no value is set or removed.
   * @param key The key to compute the value for.
   * @param fn The function to compute the value. Its input will be the key and previous value.
   * @return A promise that will be resolved with the new value for the key, or `undefined` if there was no entry for the given key or if the given function returns `undefined`.
   *         <p>
   *         If there are any pending actions for the key the returned promise will not be resolved until they have all finished.
   *         The promise will be rejected if the given function throws an error.
   */
  computeIfPresent(key: K, fn: (k: K, v: V) => V | undefined | PromiseLike<V | undefined>): Promise<V | undefined> {
    const pending = this.#pending.get(key);
    if (pending === undefined) {
      const current = this.#current.get(key);
      if (current === undefined) {
        return Promise.resolve(current);
      }
      this.#pending.set(key, []);
      return new Promise((resolve, reject) => {
        this.#computeWhenPresent(key, current, fn, resolve, reject);
      });
    }
    return new Promise((resolve, reject) => {
      pending.push(() => {
        const current = this.#current.get(key);
        if (current === undefined) {
          resolve(current);
          this.#triggerNextPending(key);
        } else {
          this.#computeWhenPresent(key, current, fn, resolve, reject);
        }
      });
    });
  }

  #computeWhenPresent(key: K, oldValue: V, fn: (k: K, v: V) => V | undefined | PromiseLike<V | undefined>, resolve: (v?: V) => void, reject: (reason: unknown) => void): void {
    Promise.resolve()
      .then(() => fn(key, oldValue))
      .then((v) => {
        if (v === undefined) {
          this.#current.delete(key);
        } else {
          this.#current.set(key, v);
        }
        resolve(v);
      })
      .catch(reject)
      .finally(() => this.#triggerNextPending(key));
  }

  /**
   * Computes the value for a key.
   * The new value will be the return value of calling the given function.
   * If the given function throws an error, the error is propagated through the returned promise and no value is set or removed.
   * @param key The key to compute the value for.
   * @param fn The function to compute the value. Its input will be the key and previous value, or `undefined` if there was no entry yet.
   * @return A promise that will be resolved with the new value for the key.
   *         <p>
   *         If there are any pending actions for the key the returned promise will not be resolved until they have all finished.
   *         The promise will be rejected if the given function throws an error.
   */
  compute(key: K, fn: (k: K, v?: V) => V | PromiseLike<V>): Promise<V>;
  /**
   * Computes the value for a key.
   * The new value will be the return value of calling the given function. However, if the given function returns `undefined`, any existing entry is removed instead.
   * If the given function throws an error, the error is propagated through the returned promise and no value is set or removed.
   * @param key The key to compute the value for.
   * @param fn The function to compute the value. Its input will be the key and previous value, or `undefined` if there was no entry yet.
   * @return A promise that will be resolved with the new value for the key, or `undefined` if the given function returns `undefined`.
   *         <p>
   *         If there are any pending actions for the key the returned promise will not be resolved until they have all finished.
   *         The promise will be rejected if the given function throws an error.
   */
  compute(key: K, fn: (k: K, v?: V) => V | undefined | PromiseLike<V | undefined>): Promise<V | undefined>;
  compute(key: K, fn: (k: K, v?: V) => V | undefined | PromiseLike<V | undefined>): Promise<V | undefined> {
    const pending = this.#pending.get(key);
    if (pending === undefined) {
      this.#pending.set(key, []);
      return new Promise((resolve, reject) => {
        this.#compute(key, fn, resolve, reject);
      });
    }
    return new Promise((resolve, reject) => {
      pending.push(() => {
        this.#compute(key, fn, resolve, reject);
      });
    });
  }

  #compute(key: K, fn: (k: K, v?: V) => V | undefined | PromiseLike<V | undefined>, resolve: (v?: V) => void, reject: (reason: unknown) => void): void {
    const oldValue = this.#current.get(key);
    Promise.resolve()
      .then(() => fn(key, oldValue))
      .then((v) => {
        if (v === undefined) {
          this.#current.delete(key);
        } else {
          this.#current.set(key, v);
        }
        resolve(v);
      })
      .catch(reject)
      .finally(() => this.#triggerNextPending(key));
  }

  /**
   * Sets the value for a key, merging it with any existing value if necessary.
   * If there was no entry yet for the key, its value will be set to the given value. Otherwise, the new value will be the return value of calling the given function.
   * If the given function throws an error, the error is propagated through the returned promise and no value is set or removed.
   * @param key The key to compute the value for.
   * @param fn The function to compute the value. Its input will be the previous value and the given value.
   * @return A promise that will be resolved with the new value for the key.
   *         <p>
   *         If there are any pending actions for the key the returned promise will not be resolved until they have all finished.
   *         The promise will be rejected if the given function throws an error.
   */
  merge(key: K, value: V, fn: (oldValue: V, newValue: V) => V | PromiseLike<V>): Promise<V>;
  /**
   * Sets the value for a key, merging it with any existing value if necessary.
   * If there was no entry yet for the key, its value will be set to the given value. Otherwise, the new value will be the return value of calling the given function.
   * However, if the given function returns `undefined`, the entry is removed instead.
   * If the given function throws an error, the error is propagated through the returned promise and no value is set or removed.
   * @param key The key to compute the value for.
   * @param fn The function to compute the value. Its input will be the previous value and the given value.
   * @return A promise that will be resolved with the new value for the key, or `undefined` if the given function returns `undefined`.
   *         <p>
   *         If there are any pending actions for the key the returned promise will not be resolved until they have all finished.
   *         The promise will be rejected if the given function throws an error.
   */
  merge(key: K, value: V, fn: (oldValue: V, newValue: V) => V | undefined | PromiseLike<V | undefined>): Promise<V | undefined>;
  merge(key: K, value: V, fn: (oldValue: V, newValue: V) => V | undefined | PromiseLike<V | undefined>): Promise<V | undefined> {
    const pending = this.#pending.get(key);
    if (pending === undefined) {
      const oldValue = this.#current.get(key);
      if (oldValue === undefined) {
        this.#current.set(key, value);
        return Promise.resolve(value);
      }
      this.#pending.set(key, []);
      return new Promise((resolve, reject) => {
        this.#merge(key, oldValue, value, fn, resolve, reject);
      });
    }
    return new Promise((resolve, reject) => {
      pending.push(() => {
        const oldValue = this.#current.get(key);
        if (oldValue === undefined) {
          this.#current.set(key, value);
          resolve(value);
          this.#triggerNextPending(key);
        } else {
          this.#merge(key, oldValue, value, fn, resolve, reject);
        }
      });
    });
  }

  #merge(
    key: K,
    oldValue: V,
    newValue: V,
    fn: (oldValue: V, newValue: V) => V | undefined | PromiseLike<V | undefined>,
    resolve: (v?: V) => void,
    reject: (reason: unknown) => void,
  ): void {
    Promise.resolve()
      .then(() => fn(oldValue, newValue))
      .then((v) => {
        if (v === undefined) {
          this.#current.delete(key);
        } else {
          this.#current.set(key, v);
        }
        resolve(v);
      })
      .catch(reject)
      .finally(() => this.#triggerNextPending(key));
  }

  /**
   * Executes a given callback on each entry.
   * This is a snapshot; the results of any pending actions will not be visible yet.
   * @param callback The function to call for each entry. Its arguments will be the value, key and this map.
   */
  forEach(callback: (v: V, k: K, map: ConcurrentMap<K, V>) => void): void {
    this.#current.forEach((v, k) => callback(v, k, this));
  }

  #result<T>(key: K, fn: () => T): Promise<T> {
    const pending = this.#pending.get(key);
    if (pending === undefined) {
      return Promise.resolve(fn());
    }
    return new Promise((resolve) => {
      pending.push(() => {
        resolve(fn());
        this.#triggerNextPending(key);
      });
    });
  }

  #triggerNextPending(key: K) {
    const pending = this.#pending.get(key);
    const nextPending = pending?.shift();
    if (nextPending) {
      nextPending();
    }
    if (pending && pending.length === 0) {
      this.#pending.delete(key);
    }
  }
}
