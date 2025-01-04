# @robtimus/concurrent
[![npm](https://img.shields.io/npm/v/@robtimus/connect-client-sdk)](https://www.npmjs.com/package/@robtimus/concurrent)
[![Build Status](https://github.com/robtimus/concurrent-ts/actions/workflows/build.yml/badge.svg)](https://github.com/robtimus/concurrent-ts/actions/workflows/build.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=robtimus%3Aconcurrent&metric=alert_status)](https://sonarcloud.io/summary/overall?id=robtimus%3Aconcurrent)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=robtimus%3Aconcurrent&metric=coverage)](https://sonarcloud.io/summary/overall?id=robtimus%3Aconcurrent)
[![Known Vulnerabilities](https://snyk.io/test/github/robtimus/concurrent-ts/badge.svg)](https://snyk.io/test/github/robtimus/concurrent-ts)

## [CountDownLatch](https://robtimus.github.io/concurrent/classes/CountDownLatch.CountDownLatch.html)

A locking mechanism that allows one or more tasks to wait until a set of operations being performed in other tasks completes.
It's inspired by Java's [CountDownLatch](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/CountDownLatch.html).

A `CountDownLatch` is initialized with a non-negative count. The promises returned by the `await()` method do not resolve until the current count reaches 0 due to calls to the `countDown()` method. This can occur only once, the count cannot be reset.

The promises returned by the `await(timeout)` are rejected if the timeout expires before the current count reaches 0. To get a `false` like Java's `CountDownLatch`, simply use `catch`:

```typescript
if (await latch.await(timeout).catch(() => false) !== false) {
  // count reached 0
} else {
  // timeout expired
}
```

### Sample usage

```typescript
const startLatch = new CountDownLatch(1);
const readyLatch = new CountDownLatch(10);
const finishLatch = new CountDownLatch(10);

for (let i = 0; i < 10; i++) {
  new Promise((resolve, reject) => {
    // tell the calling code this promise is ready to start
    readyLatch.countDown();
    // wait for the calling code to let all promises start
    startLatch.await()
      .then(() => {
        /* do work and call resolve / reject as needed */
      })
      .finally(() => {
        // tell the calling code this promise is done
        finishLatch.countDown();
      });
  });
}

// wait for all promises to be ready to start
await readyLatch.await();
// let all promises start
startLatch.countDown();
// wait for all promises to be done
await finishLatch.await();
```

## [Semaphore](https://robtimus.github.io/concurrent/classes/Semaphore.Semaphore.html)

A port of Java's [Semaphore](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/Semaphore.html).

A `Semaphore` is initialized with a non-negative number of permits. The promises returned by the `acquire()` and `acquire(permits)` methods do not resolve until enough permits are available, either because the current number is sufficient or because `release()` or `release(permits)` is called.

The promises returned by the `tryAcquire()` and `tryAcquire(permits)` methods resolve with `true` if enough permits are available, or `false` otherwise.

The promises returned by the `tryAcquire(options)` method resolve with `true` if enough permits become available before the timeout expires, or `false` otherwise.

### Sample usage

```typescript
const semaphore = new Semaphore(0);
// set if semaphore.availablePermits() > 0
let value: string;

function getValue(): Promise<string> {
  return semaphore.acquire().then(() => value);
}

function setValue(v: string): void {
  value = v;
  semaphore.release();
}
```

## [ReadWriteLock](https://robtimus.github.io/concurrent/classes/ReadWriteLock.ReadWriteLock.html)

A locking mechanism that allows multiple concurrent readers, but only one writer at a time.
It's inspired by both Java's [ReadWriteLock](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/locks/ReadWriteLock.html) and .NET's [ReaderWriterLockSlim](https://learn.microsoft.com/en-us/dotnet/api/system.threading.readerwriterlockslim).
Unlike both of these, acquiring a lock returns an object that implements [ReadLock](https://robtimus.github.io/concurrent/interfaces/ReadWriteLock.ReadLock.html) or [WriteLock](https://robtimus.github.io/concurrent/interfaces/ReadWriteLock.WriteLock.html). This allows a specific lock to be released, something that's enforced in Java and .NET by releasing locks on the same thread on which they were acquired.

### Fairness

By default a `ReadWriteLock` is fair. That means that if there are active read locks and pending write locks, new read locks will not be acquired immediately. This prevents readers from blocking writers indefinitely.

To let new read locks be acquired immediately if at least one read lock is active, set the fairness to `false`:

```typescript
const lock = new ReadWriteLock({
  fair: false,
});
```

### Sample usage

```typescript
class CachedData<T> {
  private data?: T;
  private cacheValid = false;
  private lock = new ReadWriteLock();

  async processCachedData() {
    let readLock = await this.lock.acquireReadLock();
    if (!this.cacheValid) {
      // Unlike in Java, locks can be upgraded directly
      // Unlike in .NET, any read lock can be upgraded
      const writeLock = await readLock.upgradeToWriteLock();
      try {
        // Recheck state because another invocation might have acquired the write lock
        // and changed data before the upgrade has completed.
        if (!this.cacheValid) {
          this.data = ...;
          this.cacheValid = true;
        }
      } finally {
        readLock = writeLock.downgradeToReadLock();
      }
    }
    try {
      use(this.data);
    } finally {
      readLock.release();
    }
  }
}
```

## [ConcurrentMap](https://robtimus.github.io/concurrent/classes/ConcurrentMap.ConcurrentMap.html)

An object similar to [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) that allows concurrent modification.
It's inspired by Java's [ConcurrentHashMap](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ConcurrentHashMap.html).

### Sample usage

```typescript
class CachedData<K, V> {
  private map = new ConcurrentMap<K, V>();

  async processCachedData(key: K) {
    return this.map.compute(key, (k, v) => {
      if (this.isValid(v)) {
        return v;
      }
      return this.calculate(k);
    });
  }

  private isValid(value?: V) {
    return value !== undefined && ...;
  }

  private async calculate(key: K) {
    return ...
  }
}
```
