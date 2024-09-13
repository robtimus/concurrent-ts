import { CountDownLatch } from "../src";
import { expectDurationBetween, expectResolvedImmediately } from "./testUtil";

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
  test("count > 0", async () => {
    const latch = new CountDownLatch(2);
    expect(latch.initialCount()).toBe(2);
    expectCountDownLatch(latch, 2);

    setTimeout(() => latch.countDown(), 20);
    setTimeout(() => latch.countDown(), 50);

    await expectDurationBetween(50, 100, () => latch.await());

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

    await expectResolvedImmediately(() => latch.await());

    expect(latch.initialCount()).toBe(2);
    expectCountDownLatch(latch, 0);
  });
});

describe("timed wait", () => {
  test("ready before timeout", async () => {
    const latch = new CountDownLatch(2);
    expect(latch.initialCount()).toBe(2);
    expectCountDownLatch(latch, 2);

    setTimeout(() => latch.countDown(), 20);
    setTimeout(() => latch.countDown(), 50);

    await expectDurationBetween(50, 100, () => latch.await(100));

    expect(latch.initialCount()).toBe(2);
    expectCountDownLatch(latch, 0);
  });

  test.each([-1, 0])("non-positive timeout %d", async (timeout) => {
    const latch = new CountDownLatch(1);
    expect(latch.initialCount()).toBe(1);
    expect(latch.currentCount()).toBe(1);
    expect(latch.toString()).toBe("CountDownLatch[count=1]");

    const result = await expectResolvedImmediately(() => latch.await(timeout).catch(() => false));

    expect(result).toBe(false);
    expect(latch.initialCount()).toBe(1);
    expectCountDownLatch(latch, 1);
  });

  test("timeout expires", async () => {
    const latch = new CountDownLatch(1);
    expect(latch.initialCount()).toBe(1);
    expectCountDownLatch(latch, 1);

    const result = await expectDurationBetween(50, 100, () => latch.await(50).catch(() => false));

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

    await expectResolvedImmediately(() => latch.await(timeout));

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
