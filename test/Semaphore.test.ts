import { CountDownLatch, Semaphore } from "../src";

test("zero permits", () => {
  const semaphore = new Semaphore(0);
  expect(semaphore.availablePermits()).toBe(0);
  expect(semaphore.toString()).toBe("Semaphore[permits=0]");
});

test("negative permits", () => {
  expect(() => new Semaphore(-1)).toThrow("-1 < 0");
});

describe("acquire", () => {
  test("negative permits", () => {
    const semaphore = new Semaphore(1);

    expect(() => semaphore.acquire(-1)).toThrow("-1 < 0");
    expect(semaphore.availablePermits()).toBe(1);
    expect(semaphore.toString()).toBe("Semaphore[permits=1]");
  });

  test("single permit", async () => {
    const semaphore = new Semaphore(1);

    await semaphore.acquire();

    expect(semaphore.availablePermits()).toBe(0);
    expect(semaphore.toString()).toBe("Semaphore[permits=0]");
    expect(semaphore.hasWaitingAcquirers()).toBe(false);
    expect(semaphore.waitingAcquirerCount()).toBe(0);
  });

  test("no available permits", async () => {
    const semaphore = new Semaphore(0);
    expect(semaphore.availablePermits()).toBe(0);
    expect(semaphore.toString()).toBe("Semaphore[permits=0]");

    setTimeout(() => semaphore.release(), 20);
    setTimeout(() => semaphore.release(), 50);

    const startTime = new Date();
    await semaphore.acquire(2);
    const endTime = new Date();

    expect(endTime.getTime() - startTime.getTime()).toBeGreaterThanOrEqual(50);
    expect(endTime.getTime() - startTime.getTime()).toBeLessThan(100);
    expect(semaphore.availablePermits()).toBe(0);
    expect(semaphore.toString()).toBe("Semaphore[permits=0]");
    expect(semaphore.hasWaitingAcquirers()).toBe(false);
    expect(semaphore.waitingAcquirerCount()).toBe(0);
  });

  test("available permits", async () => {
    const semaphore = new Semaphore(3);
    expect(semaphore.availablePermits()).toBe(3);
    expect(semaphore.toString()).toBe("Semaphore[permits=3]");

    const startTime = new Date();
    await semaphore.acquire(2);
    const endTime = new Date();

    expect(endTime.getTime() - startTime.getTime()).toBeLessThan(10);
    expect(semaphore.availablePermits()).toBe(1);
    expect(semaphore.toString()).toBe("Semaphore[permits=1]");
    expect(semaphore.hasWaitingAcquirers()).toBe(false);
    expect(semaphore.waitingAcquirerCount()).toBe(0);
  });
});

describe("tryAcquire", () => {
  describe("without timeout", () => {
    test("negative permits", () => {
      const semaphore = new Semaphore(1);

      expect(() => semaphore.tryAcquire(-1)).toThrow("-1 < 0");
      expect(semaphore.availablePermits()).toBe(1);
      expect(semaphore.toString()).toBe("Semaphore[permits=1]");
    });

    test("available immediately", async () => {
      const semaphore = new Semaphore(1);
      expect(semaphore.availablePermits()).toBe(1);
      expect(semaphore.toString()).toBe("Semaphore[permits=1]");

      const startTime = new Date();
      const result = semaphore.tryAcquire();
      const endTime = new Date();

      expect(result).toBe(true);
      expect(endTime.getTime() - startTime.getTime()).toBeLessThan(10);
      expect(semaphore.availablePermits()).toBe(0);
      expect(semaphore.toString()).toBe("Semaphore[permits=0]");
      expect(semaphore.hasWaitingAcquirers()).toBe(false);
      expect(semaphore.waitingAcquirerCount()).toBe(0);
    });

    test("not available", async () => {
      const semaphore = new Semaphore(1);
      expect(semaphore.availablePermits()).toBe(1);
      expect(semaphore.toString()).toBe("Semaphore[permits=1]");

      const startTime = new Date();
      const result = semaphore.tryAcquire(2);
      const endTime = new Date();

      expect(result).toBe(false);
      expect(endTime.getTime() - startTime.getTime()).toBeLessThan(10);
      expect(semaphore.availablePermits()).toBe(1);
      expect(semaphore.toString()).toBe("Semaphore[permits=1]");
      expect(semaphore.hasWaitingAcquirers()).toBe(false);
      expect(semaphore.waitingAcquirerCount()).toBe(0);
    });
  });

  describe("with timeout", () => {
    test("negative permits", () => {
      const semaphore = new Semaphore(1);

      expect(() =>
        semaphore.tryAcquire({
          permits: -1,
          timeout: 0,
        }),
      ).toThrow("-1 < 0");
      expect(semaphore.availablePermits()).toBe(1);
      expect(semaphore.toString()).toBe("Semaphore[permits=1]");
    });

    test("available immediately", async () => {
      const semaphore = new Semaphore(1);
      expect(semaphore.availablePermits()).toBe(1);
      expect(semaphore.toString()).toBe("Semaphore[permits=1]");

      const startTime = new Date();
      const result = await semaphore.tryAcquire({
        timeout: 100,
      });
      const endTime = new Date();

      expect(result).toBe(true);
      expect(endTime.getTime() - startTime.getTime()).toBeLessThan(10);
      expect(semaphore.availablePermits()).toBe(0);
      expect(semaphore.toString()).toBe("Semaphore[permits=0]");
      expect(semaphore.hasWaitingAcquirers()).toBe(false);
      expect(semaphore.waitingAcquirerCount()).toBe(0);
    });
  });

  test.each([-1, 0])("not available with non-positive timeout %d", async (timeout) => {
    const semaphore = new Semaphore(1);
    expect(semaphore.availablePermits()).toBe(1);
    expect(semaphore.toString()).toBe("Semaphore[permits=1]");

    const startTime = new Date();
    const result = await semaphore.tryAcquire({
      permits: 2,
      timeout,
    });
    const endTime = new Date();

    expect(result).toBe(false);
    expect(endTime.getTime() - startTime.getTime()).toBeLessThan(10);
    expect(semaphore.availablePermits()).toBe(1);
    expect(semaphore.toString()).toBe("Semaphore[permits=1]");
    expect(semaphore.hasWaitingAcquirers()).toBe(false);
    expect(semaphore.waitingAcquirerCount()).toBe(0);
  });

  test("not available within timeout", async () => {
    const semaphore = new Semaphore(1);
    expect(semaphore.availablePermits()).toBe(1);
    expect(semaphore.toString()).toBe("Semaphore[permits=1]");

    const releaseLatch = new CountDownLatch(1);
    const releasedLatch = new CountDownLatch(1);
    setTimeout(async () => {
      await releaseLatch.wait();
      semaphore.release(10);
      releasedLatch.countDown();
    }, 100);

    const startTime = new Date();
    const result = await semaphore.tryAcquire({
      permits: 2,
      timeout: 10,
    });
    const endTime = new Date();

    expect(result).toBe(false);
    expect(endTime.getTime() - startTime.getTime()).toBeGreaterThanOrEqual(10);
    expect(semaphore.availablePermits()).toBe(1);
    expect(semaphore.toString()).toBe("Semaphore[permits=1]");
    expect(semaphore.hasWaitingAcquirers()).toBe(false);
    expect(semaphore.waitingAcquirerCount()).toBe(0);

    releaseLatch.countDown();
    await releasedLatch.wait();

    expect(semaphore.availablePermits()).toBe(11);
    expect(semaphore.toString()).toBe("Semaphore[permits=11]");
  });

  test("available within timeout", async () => {
    const semaphore = new Semaphore(1);
    expect(semaphore.availablePermits()).toBe(1);
    expect(semaphore.toString()).toBe("Semaphore[permits=1]");

    setTimeout(() => semaphore.release(2), 20);
    setTimeout(() => semaphore.release(8), 50);

    const startTime = new Date();
    const result = await semaphore.tryAcquire({
      permits: 5,
      timeout: 100,
    });
    const endTime = new Date();

    expect(result).toBe(true);
    expect(endTime.getTime() - startTime.getTime()).toBeGreaterThanOrEqual(50);
    expect(endTime.getTime() - startTime.getTime()).toBeLessThan(100);
    expect(semaphore.availablePermits()).toBe(6);
    expect(semaphore.toString()).toBe("Semaphore[permits=6]");
    expect(semaphore.hasWaitingAcquirers()).toBe(false);
    expect(semaphore.waitingAcquirerCount()).toBe(0);
  });
});

describe("release", () => {
  test("negative permits", () => {
    const semaphore = new Semaphore(1);
    expect(semaphore.availablePermits()).toBe(1);
    expect(semaphore.toString()).toBe("Semaphore[permits=1]");

    expect(() => semaphore.release(-1)).toThrow("-1 < 0");
    expect(semaphore.availablePermits()).toBe(1);
    expect(semaphore.toString()).toBe("Semaphore[permits=1]");
  });
});

test("drainPermits", () => {
  const semaphore = new Semaphore(100);
  expect(semaphore.availablePermits()).toBe(100);
  expect(semaphore.toString()).toBe("Semaphore[permits=100]");

  semaphore.drainPermits();
  expect(semaphore.availablePermits()).toBe(0);
  expect(semaphore.toString()).toBe("Semaphore[permits=0]");
});

test("waiting acquirers", async () => {
  const semaphore = new Semaphore(0);
  expect(semaphore.availablePermits()).toBe(0);
  expect(semaphore.toString()).toBe("Semaphore[permits=0]");

  expect(semaphore.hasWaitingAcquirers()).toBe(false);
  expect(semaphore.waitingAcquirerCount()).toBe(0);

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

  expect(semaphore.hasWaitingAcquirers()).toBe(false);
  expect(semaphore.waitingAcquirerCount()).toBe(0);

  await waitingLatch.wait();

  expect(semaphore.hasWaitingAcquirers()).toBe(true);
  expect(semaphore.waitingAcquirerCount()).toBe(2);
  expect(semaphore.availablePermits()).toBe(0);
  expect(semaphore.toString()).toBe("Semaphore[permits=0]");

  semaphore.release(5);

  expect(semaphore.hasWaitingAcquirers()).toBe(true);
  expect(semaphore.waitingAcquirerCount()).toBe(1);
  expect(semaphore.availablePermits()).toBe(2);
  expect(semaphore.toString()).toBe("Semaphore[permits=2]");

  semaphore.release();

  expect(semaphore.hasWaitingAcquirers()).toBe(false);
  expect(semaphore.waitingAcquirerCount()).toBe(0);
  expect(semaphore.availablePermits()).toBe(0);
  expect(semaphore.toString()).toBe("Semaphore[permits=0]");
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
