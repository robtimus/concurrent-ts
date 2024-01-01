import { CountDownLatch, Semaphore } from "../src";
import { expectDurationAtLeast, expectDurationBetween, expectResolvedImmediately } from "./testUtil";

function expectSemaphore(semaphore: Semaphore, availablePermits: number, hasWaitingAcquirers = false, waitingAcquirerCount = 0): void {
  expect(semaphore.availablePermits()).toBe(availablePermits);
  expect(semaphore.hasWaitingAcquirers()).toBe(hasWaitingAcquirers);
  expect(semaphore.waitingAcquirerCount()).toBe(waitingAcquirerCount);
}

test("zero permits", () => {
  const semaphore = new Semaphore(0);
  expectSemaphore(semaphore, 0);
});

test("negative permits", () => {
  expect(() => new Semaphore(-1)).toThrow("-1 < 0");
});

describe("acquire", () => {
  test("negative permits", () => {
    const semaphore = new Semaphore(1);
    expectSemaphore(semaphore, 1);

    expect(() => semaphore.acquire(-1)).toThrow("-1 < 0");
    expectSemaphore(semaphore, 1);
  });

  test("single permit", async () => {
    const semaphore = new Semaphore(1);
    expectSemaphore(semaphore, 1);

    await semaphore.acquire();

    expectSemaphore(semaphore, 0);
  });

  test("no available permits", async () => {
    const semaphore = new Semaphore(0);
    expectSemaphore(semaphore, 0);

    setTimeout(() => semaphore.release(), 20);
    setTimeout(() => semaphore.release(), 50);

    await expectDurationBetween(50, 100, () => semaphore.acquire(2));

    expectSemaphore(semaphore, 0);
  });

  test("available permits", async () => {
    const semaphore = new Semaphore(3);
    expectSemaphore(semaphore, 3);

    await expectResolvedImmediately(() => semaphore.acquire(2));

    expectSemaphore(semaphore, 1);
  });
});

describe("tryAcquire", () => {
  describe("without timeout", () => {
    test("negative permits", () => {
      const semaphore = new Semaphore(1);
      expectSemaphore(semaphore, 1);

      expect(() => semaphore.tryAcquire(-1)).toThrow("-1 < 0");
      expectSemaphore(semaphore, 1);
    });

    test("available immediately", async () => {
      const semaphore = new Semaphore(1);
      expectSemaphore(semaphore, 1);

      const result = semaphore.tryAcquire();

      expect(result).toBe(true);
      expectSemaphore(semaphore, 0);
    });

    test("not available", async () => {
      const semaphore = new Semaphore(1);
      expectSemaphore(semaphore, 1);

      const result = semaphore.tryAcquire(2);

      expect(result).toBe(false);
      expectSemaphore(semaphore, 1);
    });
  });

  describe("with timeout", () => {
    test("negative permits", () => {
      const semaphore = new Semaphore(1);
      expectSemaphore(semaphore, 1);

      expect(() =>
        semaphore.tryAcquire({
          permits: -1,
          timeout: 0,
        }),
      ).toThrow("-1 < 0");
      expectSemaphore(semaphore, 1);
    });

    test("available immediately", async () => {
      const semaphore = new Semaphore(1);
      expectSemaphore(semaphore, 1);

      const result = await expectResolvedImmediately(() =>
        semaphore.tryAcquire({
          timeout: 100,
        }),
      );

      expect(result).toBe(true);
      expectSemaphore(semaphore, 0);
    });
  });

  test.each([-1, 0])("not available with non-positive timeout %d", async (timeout) => {
    const semaphore = new Semaphore(1);
    expectSemaphore(semaphore, 1);

    const result = await expectResolvedImmediately(() =>
      semaphore.tryAcquire({
        permits: 2,
        timeout,
      }),
    );

    expect(result).toBe(false);
    expectSemaphore(semaphore, 1);
  });

  test("not available within timeout", async () => {
    const semaphore = new Semaphore(1);
    expectSemaphore(semaphore, 1);

    const releaseLatch = new CountDownLatch(1);
    const releasedLatch = new CountDownLatch(1);
    setTimeout(async () => {
      await releaseLatch.wait();
      semaphore.release(10);
      releasedLatch.countDown();
    }, 100);

    const result = await expectDurationAtLeast(50, () =>
      semaphore.tryAcquire({
        permits: 2,
        timeout: 50,
      }),
    );

    expect(result).toBe(false);
    expectSemaphore(semaphore, 1);

    releaseLatch.countDown();
    await releasedLatch.wait();

    expectSemaphore(semaphore, 11);
  });

  test("available within timeout", async () => {
    const semaphore = new Semaphore(1);
    expectSemaphore(semaphore, 1);

    setTimeout(() => semaphore.release(2), 20);
    setTimeout(() => semaphore.release(8), 50);

    const result = await expectDurationBetween(50, 100, () =>
      semaphore.tryAcquire({
        permits: 5,
        timeout: 100,
      }),
    );

    expect(result).toBe(true);
    expectSemaphore(semaphore, 6);
  });
});

describe("release", () => {
  test("negative permits", () => {
    const semaphore = new Semaphore(1);
    expectSemaphore(semaphore, 1);

    expect(() => semaphore.release(-1)).toThrow("-1 < 0");
    expectSemaphore(semaphore, 1);
  });
});

test("drainPermits", () => {
  const semaphore = new Semaphore(100);
  expectSemaphore(semaphore, 100);

  semaphore.drainPermits();
  expectSemaphore(semaphore, 0);
});

test("waiting acquirers", async () => {
  const semaphore = new Semaphore(0);
  expectSemaphore(semaphore, 0);

  const waitingLatch = new CountDownLatch(2);
  setTimeout(() => {
    // no await, so the promise's result is ignored
    semaphore.acquire(3);
    waitingLatch.countDown();
  }, 20);
  setTimeout(() => {
    // no await, so the promise's result is ignored
    semaphore.acquire(3);
    waitingLatch.countDown();
  }, 50);

  expectSemaphore(semaphore, 0);

  await waitingLatch.wait();

  expectSemaphore(semaphore, 0, true, 2);

  semaphore.release(5);

  expectSemaphore(semaphore, 2, true, 1);

  semaphore.release();

  expectSemaphore(semaphore, 0);
});

test.each([
  [0, "Semaphore[permits=0]"],
  [1, "Semaphore[permits=1]"],
  [2, "Semaphore[permits=2]"],
])("toString (permits: %d)", (permits, stringValue) => {
  const semaphore = new Semaphore(permits);
  expect(semaphore.availablePermits()).toBe(permits);
  expect(semaphore.toString()).toBe(stringValue);
});

test("example", async () => {
  const semaphore = new Semaphore(0);

  let value: string;

  function getValue(): Promise<string> {
    return semaphore.acquire().then(() => value);
  }

  function setValue(v: string): void {
    value = v;
    semaphore.release();
  }

  setTimeout(() => setValue("foo"), 50);

  const v = await getValue();
  expect(v).toBe("foo");
});
