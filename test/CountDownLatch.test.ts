import { CountDownLatch } from "../src";
import { captureTimeouts, expectedCapturedTimeouts, expectedRemainingTimeouts, restoreTimeouts } from "./testUtil";

function expectCountDownLatch(latch: CountDownLatch, currentCount: number): void {
  expect(latch.currentCount()).toBe(currentCount);
}

test("zero count", () => {
  const latch = new CountDownLatch(0);
  expect(latch.initialCount()).toBe(0);
  expectCountDownLatch(latch, 0);
});

test("negative count", () => {
  expect(() => new CountDownLatch(-1)).toThrow("-1 < 0");
});

describe("untimed wait", () => {
  beforeEach(() => captureTimeouts());

  afterEach(() => restoreTimeouts());

  test("count > 0", async () => {
    const latch = new CountDownLatch(2);
    expect(latch.initialCount()).toBe(2);
    expectCountDownLatch(latch, 2);

    setTimeout(() => latch.countDown(), 20);
    setTimeout(() => latch.countDown(), 50);

    await latch.await();

    expectedCapturedTimeouts(20, 50);
    expectedRemainingTimeouts();

    expect(latch.initialCount()).toBe(2);
    expectCountDownLatch(latch, 0);
  });

  test("count is 0", async () => {
    const latch = new CountDownLatch(2);
    expectCountDownLatch(latch, 2);

    latch.countDown();
    expectCountDownLatch(latch, 1);

    latch.countDown();
    expectCountDownLatch(latch, 0);

    await latch.await();

    expectedCapturedTimeouts();
    expectedRemainingTimeouts();

    expect(latch.initialCount()).toBe(2);
    expectCountDownLatch(latch, 0);
  });
});

describe("timed wait", () => {
  beforeEach(() => captureTimeouts());

  afterEach(() => restoreTimeouts());

  test("ready before timeout", async () => {
    const latch = new CountDownLatch(2);
    expect(latch.initialCount()).toBe(2);
    expectCountDownLatch(latch, 2);

    setTimeout(() => latch.countDown(), 20);
    setTimeout(() => latch.countDown(), 50);

    await latch.await(100);

    expectedCapturedTimeouts(20, 50);
    expectedRemainingTimeouts();

    expect(latch.initialCount()).toBe(2);
    expectCountDownLatch(latch, 0);
  });

  test.each([-1, 0])("non-positive timeout %d", async (timeout) => {
    const latch = new CountDownLatch(1);
    expect(latch.initialCount()).toBe(1);
    expect(latch.currentCount()).toBe(1);
    expect(latch.toString()).toBe("CountDownLatch[count=1]");

    const result = await latch.await(timeout).catch(() => false);

    expectedCapturedTimeouts();
    expectedRemainingTimeouts();

    expect(result).toBe(false);
    expect(latch.initialCount()).toBe(1);
    expectCountDownLatch(latch, 1);
  });

  test("timeout expires", async () => {
    const latch = new CountDownLatch(1);
    expect(latch.initialCount()).toBe(1);
    expectCountDownLatch(latch, 1);

    const result = await latch.await(50).catch(() => false);

    expectedCapturedTimeouts(50);
    expectedRemainingTimeouts();

    expect(result).toBe(false);
    expect(latch.initialCount()).toBe(1);
    expectCountDownLatch(latch, 1);
  });

  test.each([50, 0, -1])("count is 0 (timeout: %d)", async (timeout) => {
    const latch = new CountDownLatch(2);
    expect(latch.initialCount()).toBe(2);
    expectCountDownLatch(latch, 2);

    latch.countDown();
    expectCountDownLatch(latch, 1);

    latch.countDown();
    expectCountDownLatch(latch, 0);

    await latch.await(timeout);

    expectedCapturedTimeouts();
    expectedRemainingTimeouts();

    expect(latch.initialCount()).toBe(2);
    expectCountDownLatch(latch, 0);
  });
});

test.each([
  [0, "CountDownLatch[count=0]"],
  [1, "CountDownLatch[count=1]"],
  [2, "CountDownLatch[count=2]"],
])("toString (count: %d)", (count, stringValue) => {
  const latch = new CountDownLatch(count);
  expect(latch.currentCount()).toBe(count);
  expect(latch.toString()).toBe(stringValue);
});

describe("examples", () => {
  describe("catch", () => {
    test("count reached", async () => {
      const latch = new CountDownLatch(0);
      const timeout = 10;

      let expired: boolean;
      if ((await latch.await(timeout).catch(() => false)) !== false) {
        // count reached 0
        expired = false;
      } else {
        // timeout expired
        expired = true;
      }

      expect(expired).toBe(false);
    });

    test("timeout expired", async () => {
      const latch = new CountDownLatch(1);
      const timeout = 10;

      let expired: boolean;
      if ((await latch.await(timeout).catch(() => false)) !== false) {
        // count reached 0
        expired = false;
      } else {
        // timeout expired
        expired = true;
      }

      expect(expired).toBe(true);
    });
  });

  test("sample usage", async () => {
    const startLatch = new CountDownLatch(1);
    const readyLatch = new CountDownLatch(10);
    const finishLatch = new CountDownLatch(10);

    let totalCount = 0;

    for (let i = 0; i < 10; i++) {
      new Promise<void>((resolve) => {
        readyLatch.countDown();
        startLatch.await().then(() => {
          setTimeout(() => {
            totalCount++;
            resolve();
            finishLatch.countDown();
          }, 100);
        });
      });
    }

    await readyLatch.await();
    startLatch.countDown();
    await finishLatch.await();

    expect(totalCount).toBe(10);
  });
});
