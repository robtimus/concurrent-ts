# @robtimus/concurrent
[![npm](https://img.shields.io/npm/v/@robtimus/connect-client-sdk)](https://www.npmjs.com/package/@robtimus/concurrent)
[![Build Status](https://github.com/robtimus/concurrent-ts/actions/workflows/build.yml/badge.svg)](https://github.com/robtimus/concurrent-ts/actions/workflows/build.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=robtimus%3Aconcurrent&metric=alert_status)](https://sonarcloud.io/summary/overall?id=robtimus%3Aconcurrent)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=robtimus%3Aconcurrent&metric=coverage)](https://sonarcloud.io/summary/overall?id=robtimus%3Aconcurrent)
[![Known Vulnerabilities](https://snyk.io/test/github/robtimus/concurrent-ts/badge.svg)](https://snyk.io/test/github/robtimus/concurrent-ts)

## CountDownLatch

A port of Java's [CountDownLatch](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/CountDownLatch.html).

A `CountDownLatch` is initialized with a non-negative count. The promises returned by the `await()` method do not resolve until the current count reaches 0 due to calls to the `countDown()` method. This can occur only once, the count cannot be reset.

The promises returned by the `await(timeout)` method resolve with `true` if the current count reaches 0 before the timeout expires, or `false` otherwise.

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
