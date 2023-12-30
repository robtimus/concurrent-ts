import { CountDownLatch } from "../src";

test("zero count", () => {
  const latch = new CountDownLatch(0);
  expect(latch.getCount()).toBe(0);
  expect(latch.toString()).toBe("CountDownLatch[count=0]");
});

test("negative count", () => {
  expect(() => new CountDownLatch(-1)).toThrow("-1 < 0");
});

describe("untimed wait", () => {
  test("count > 0", async () => {
    const latch = new CountDownLatch(2);
    expect(latch.getCount()).toBe(2);
    expect(latch.toString()).toBe("CountDownLatch[count=2]");

    setTimeout(() => latch.countDown(), 20);
    setTimeout(() => latch.countDown(), 50);

    const startTime = new Date();
    await latch.wait();
    const endTime = new Date();

    expect(endTime.getTime() - startTime.getTime()).toBeGreaterThanOrEqual(50);
    expect(endTime.getTime() - startTime.getTime()).toBeLessThan(100);
    expect(latch.getCount()).toBe(0);
    expect(latch.toString()).toBe("CountDownLatch[count=0]");
  });

  test("count is 0", async () => {
    const latch = new CountDownLatch(2);
    expect(latch.getCount()).toBe(2);
    expect(latch.toString()).toBe("CountDownLatch[count=2]");

    latch.countDown();
    expect(latch.getCount()).toBe(1);
    expect(latch.toString()).toBe("CountDownLatch[count=1]");

    latch.countDown();
    expect(latch.getCount()).toBe(0);
    expect(latch.toString()).toBe("CountDownLatch[count=0]");

    const startTime = new Date();
    await latch.wait();
    const endTime = new Date();

    expect(endTime.getTime() - startTime.getTime()).toBeLessThan(10);
    expect(latch.getCount()).toBe(0);
    expect(latch.toString()).toBe("CountDownLatch[count=0]");
  });
});

describe("timed wait", () => {
  test("ready before timeout", async () => {
    const latch = new CountDownLatch(2);
    expect(latch.getCount()).toBe(2);
    expect(latch.toString()).toBe("CountDownLatch[count=2]");

    setTimeout(() => latch.countDown(), 20);
    setTimeout(() => latch.countDown(), 50);

    const startTime = new Date();
    const result = await latch.wait(100);
    const endTime = new Date();

    expect(result).toBe(true);
    expect(endTime.getTime() - startTime.getTime()).toBeGreaterThanOrEqual(50);
    expect(endTime.getTime() - startTime.getTime()).toBeLessThan(100);
    expect(latch.getCount()).toBe(0);
    expect(latch.toString()).toBe("CountDownLatch[count=0]");
  });

  test.each([-1, 0])("non-positive timeout %d", async (timeout) => {
    const latch = new CountDownLatch(1);
    expect(latch.getCount()).toBe(1);
    expect(latch.toString()).toBe("CountDownLatch[count=1]");

    const startTime = new Date();
    const result = await latch.wait(timeout);
    const endTime = new Date();

    expect(result).toBe(false);
    expect(endTime.getTime() - startTime.getTime()).toBeLessThan(10);
    expect(latch.getCount()).toBe(1);
    expect(latch.toString()).toBe("CountDownLatch[count=1]");
  });

  test("timeout expires", async () => {
    const latch = new CountDownLatch(1);
    expect(latch.getCount()).toBe(1);
    expect(latch.toString()).toBe("CountDownLatch[count=1]");

    const startTime = new Date();
    const result = await latch.wait(50);
    const endTime = new Date();

    expect(result).toBe(false);
    expect(endTime.getTime() - startTime.getTime()).toBeGreaterThanOrEqual(50);
    expect(endTime.getTime() - startTime.getTime()).toBeLessThan(100);
    expect(latch.getCount()).toBe(1);
    expect(latch.toString()).toBe("CountDownLatch[count=1]");
  });

  test("count is 0", async () => {
    const latch = new CountDownLatch(2);
    expect(latch.getCount()).toBe(2);
    expect(latch.toString()).toBe("CountDownLatch[count=2]");

    latch.countDown();
    expect(latch.getCount()).toBe(1);
    expect(latch.toString()).toBe("CountDownLatch[count=1]");

    latch.countDown();
    expect(latch.getCount()).toBe(0);
    expect(latch.toString()).toBe("CountDownLatch[count=0]");

    const startTime = new Date();
    const result = await latch.wait(50);
    const endTime = new Date();

    expect(result).toBe(true);
    expect(endTime.getTime() - startTime.getTime()).toBeLessThanOrEqual(10);
    expect(latch.getCount()).toBe(0);
    expect(latch.toString()).toBe("CountDownLatch[count=0]");
  });
});

test("example", async () => {
  const startLatch = new CountDownLatch(1);
  const readyLatch = new CountDownLatch(10);
  const finishLatch = new CountDownLatch(10);

  let totalCount = 0;

  for (let i = 0; i < 10; i++) {
    new Promise<void>((resolve) => {
      readyLatch.countDown();
      startLatch.wait().then(() => {
        setTimeout(() => {
          totalCount++;
          resolve();
          finishLatch.countDown();
        }, 100);
      });
    });
  }

  await readyLatch.wait();
  startLatch.countDown();
  await finishLatch.wait();

  expect(totalCount).toBe(10);
});
