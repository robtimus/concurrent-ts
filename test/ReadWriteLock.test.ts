import { ReadLock, ReadWriteLock, WriteLock } from "../src";
import { expectDurationBetween, expectResolvedImmediately } from "./testUtil";

function expectReadWriteLock(lock: ReadWriteLock, isReadLockHeld: boolean, isWriteLockHeld: boolean, currentReadCount: number, waitingReadCount = 0, waitingWriteCount = 0): void {
  expect(lock.isReadLockHeld()).toBe(isReadLockHeld);
  expect(lock.isWriteLockHeld()).toBe(isWriteLockHeld);
  expect(lock.currentReadCount()).toBe(currentReadCount);
  expect(lock.waitingReadCount()).toBe(waitingReadCount);
  expect(lock.waitingWriteCount()).toBe(waitingWriteCount);
}

describe("acquire read locks", () => {
  describe("without timeout", () => {
    test("acquire multiple without locks", async () => {
      const lock = new ReadWriteLock();
      expectReadWriteLock(lock, false, false, 0);

      const readLockPromises: Promise<ReadLock>[] = [];
      for (let i = 0; i < 10; i++) {
        readLockPromises.push(lock.acquireReadLock());
      }

      expectReadWriteLock(lock, true, false, 10);

      const readLocks = await expectResolvedImmediately(() => Promise.all(readLockPromises));

      expectReadWriteLock(lock, true, false, 10);

      readLocks.forEach((readLock) => readLock.release());

      expectReadWriteLock(lock, false, false, 0);
    });

    test.each([true, false])("acquire multiple with write lock (fair: %s)", async (fair) => {
      const lock = new ReadWriteLock({
        fair,
      });
      expectReadWriteLock(lock, false, false, 0);

      const writeLock = await lock.acquireWriteLock();

      expectReadWriteLock(lock, false, true, 0);

      const readLockPromises: Promise<ReadLock>[] = [];
      for (let i = 0; i < 10; i++) {
        readLockPromises.push(lock.acquireReadLock());
      }

      expectReadWriteLock(lock, false, true, 0, 10, 0);

      setTimeout(() => writeLock.release(), 50);

      const readLocks = await expectDurationBetween(50, 100, () => Promise.all(readLockPromises));

      expectReadWriteLock(lock, true, false, 10);

      readLocks.forEach((readLock) => readLock.release());

      expectReadWriteLock(lock, false, false, 0);
    });

    describe("acquire multiple with read and write lock", () => {
      test("fair", async () => {
        const lock = new ReadWriteLock();
        expectReadWriteLock(lock, false, false, 0);

        const initialReadLock = await lock.acquireReadLock();
        const writeLockPromise = lock.acquireWriteLock();

        expectReadWriteLock(lock, true, false, 1, 0, 1);

        setTimeout(() => initialReadLock.release(), 0);
        setTimeout(async () => (await writeLockPromise).release(), 50);

        const readLockPromises: Promise<ReadLock>[] = [];
        for (let i = 0; i < 10; i++) {
          readLockPromises.push(lock.acquireReadLock());
        }

        expectReadWriteLock(lock, true, false, 1, 10, 1);

        const readLocks = await expectDurationBetween(50, 100, () => Promise.all(readLockPromises));

        expectReadWriteLock(lock, true, false, 10, 0, 0);

        readLocks.forEach((readLock) => readLock.release());

        expectReadWriteLock(lock, false, false, 0);
      });

      test("non-fair", async () => {
        const lock = new ReadWriteLock({
          fair: false,
        });
        expectReadWriteLock(lock, false, false, 0);

        const initialReadLock = await lock.acquireReadLock();
        const writeLockPromise = lock.acquireWriteLock();

        expectReadWriteLock(lock, true, false, 1, 0, 1);

        const readLockPromises: Promise<ReadLock>[] = [];
        for (let i = 0; i < 10; i++) {
          readLockPromises.push(lock.acquireReadLock());
        }

        expectReadWriteLock(lock, true, false, 11, 0, 1);

        const readLocks = await expectResolvedImmediately(() => Promise.all(readLockPromises));

        expectReadWriteLock(lock, true, false, 11, 0, 1);

        initialReadLock.release();

        readLocks.forEach((readLock) => readLock.release());

        expectReadWriteLock(lock, false, true, 0);

        (await writeLockPromise).release();

        expectReadWriteLock(lock, false, false, 0);
      });
    });
  });

  describe("with timeout", () => {
    test("acquire multiple without locks", async () => {
      const lock = new ReadWriteLock();
      expectReadWriteLock(lock, false, false, 0);

      const readLockPromises: Promise<ReadLock>[] = [];
      for (let i = 0; i < 10; i++) {
        readLockPromises.push(lock.acquireReadLock(100));
      }

      expectReadWriteLock(lock, true, false, 10);

      const readLocks = await expectResolvedImmediately(() => Promise.all(readLockPromises));

      expectReadWriteLock(lock, true, false, 10);

      readLocks.forEach((readLock) => readLock.release());

      expectReadWriteLock(lock, false, false, 0);
    });

    describe("acquire multiple with write lock", () => {
      test.each([
        [0, true],
        [-1, true],
        [0, false],
        [-1, false],
      ])("with non-positive timeout %d (fair: %s)", async (timeout, fair) => {
        const lock = new ReadWriteLock({
          fair,
        });
        expectReadWriteLock(lock, false, false, 0);

        const writeLock = await lock.acquireWriteLock();

        expectReadWriteLock(lock, false, true, 0);

        const readLockResultPromises: Promise<ReadLock | false>[] = [];
        for (let i = 0; i < 10; i++) {
          readLockResultPromises.push(lock.acquireReadLock(timeout).catch(() => false));
        }

        expectReadWriteLock(lock, false, true, 0, 0, 0);

        const result = await expectResolvedImmediately(() => Promise.all(readLockResultPromises));

        expect(result).toStrictEqual(Array(10).fill(false));

        writeLock.release();

        expectReadWriteLock(lock, false, false, 0);
      });

      test.each([true, false])("not available within timeout (fair: %s)", async (fair) => {
        const lock = new ReadWriteLock({
          fair,
        });
        expectReadWriteLock(lock, false, false, 0);

        const writeLock = await lock.acquireWriteLock();

        expectReadWriteLock(lock, false, true, 0);

        const readLockResultPromises: Promise<ReadLock | false>[] = [];
        for (let i = 0; i < 10; i++) {
          readLockResultPromises.push(lock.acquireReadLock(50).catch(() => false));
        }

        expectReadWriteLock(lock, false, true, 0, 10, 0);

        const result = await expectDurationBetween(50, 100, () => Promise.all(readLockResultPromises));

        expect(result).toStrictEqual(Array(10).fill(false));

        writeLock.release();

        expectReadWriteLock(lock, false, false, 0);
      });

      test.each([true, false])("available within timeout (fair: %s)", async (fair) => {
        const lock = new ReadWriteLock({
          fair,
        });
        expectReadWriteLock(lock, false, false, 0);

        const writeLock = await lock.acquireWriteLock();

        expectReadWriteLock(lock, false, true, 0);

        const readLockPromises: Promise<ReadLock>[] = [];
        for (let i = 0; i < 10; i++) {
          readLockPromises.push(lock.acquireReadLock(100));
        }

        expectReadWriteLock(lock, false, true, 0, 10, 0);

        setTimeout(() => writeLock.release(), 50);

        const readLocks = await expectDurationBetween(50, 100, () => Promise.all(readLockPromises));

        expectReadWriteLock(lock, true, false, 10);

        readLocks.forEach((readLock) => readLock.release());

        expectReadWriteLock(lock, false, false, 0);
      });
    });

    describe("acquire multiple with read and write lock", () => {
      test("fair", async () => {
        const lock = new ReadWriteLock();
        expectReadWriteLock(lock, false, false, 0);

        const initialReadLock = await lock.acquireReadLock();
        const writeLockPromise = lock.acquireWriteLock();

        expectReadWriteLock(lock, true, false, 1, 0, 1);

        setTimeout(() => initialReadLock.release(), 0);
        setTimeout(async () => (await writeLockPromise).release(), 50);

        const readLockPromises: Promise<ReadLock>[] = [];
        for (let i = 0; i < 10; i++) {
          readLockPromises.push(lock.acquireReadLock(100));
        }

        expectReadWriteLock(lock, true, false, 1, 10, 1);

        const readLocks = await expectDurationBetween(50, 100, () => Promise.all(readLockPromises));

        expectReadWriteLock(lock, true, false, 10, 0, 0);

        readLocks.forEach((readLock) => readLock.release());

        expectReadWriteLock(lock, false, false, 0);
      });

      test("non-fair", async () => {
        const lock = new ReadWriteLock({
          fair: false,
        });
        expectReadWriteLock(lock, false, false, 0);

        const initialReadLock = await lock.acquireReadLock();
        const writeLockPromise = lock.acquireWriteLock();

        expectReadWriteLock(lock, true, false, 1, 0, 1);

        const readLockPromises: Promise<ReadLock>[] = [];
        for (let i = 0; i < 10; i++) {
          readLockPromises.push(lock.acquireReadLock(100));
        }

        expectReadWriteLock(lock, true, false, 11, 0, 1);

        const readLocks = await expectResolvedImmediately(() => Promise.all(readLockPromises));

        expectReadWriteLock(lock, true, false, 11, 0, 1);

        initialReadLock.release();

        readLocks.forEach((readLock) => readLock.release());

        expectReadWriteLock(lock, false, true, 0);

        (await writeLockPromise).release();

        expectReadWriteLock(lock, false, false, 0);
      });
    });
  });
});

describe("release read lock", () => {
  test("no longer held", async () => {
    const lock = new ReadWriteLock();
    expectReadWriteLock(lock, false, false, 0);

    const readLock = await lock.acquireReadLock();

    expect(readLock.isHeld()).toBe(true);

    readLock.release();

    expect(readLock.isHeld()).toBe(false);
    expect(() => readLock.release()).toThrow("Read lock is no longer held");
  });
});

describe("acquire write locks", () => {
  describe("without timeout", () => {
    test("acquire multiple without locks", async () => {
      const lock = new ReadWriteLock();
      expectReadWriteLock(lock, false, false, 0);

      const writeLockPromises: Promise<WriteLock>[] = [];
      for (let i = 0; i < 10; i++) {
        writeLockPromises.push(lock.acquireWriteLock());
      }

      expectReadWriteLock(lock, false, true, 0, 0, 9);

      let writeLock = await expectResolvedImmediately(() => writeLockPromises.shift()!);

      while (writeLockPromises.length > 0) {
        expectReadWriteLock(lock, false, true, 0, 0, writeLockPromises.length);

        setTimeout(() => writeLock.release(), 50);

        writeLock = await expectDurationBetween(50, 100, () => writeLockPromises.shift()!);
      }

      expectReadWriteLock(lock, false, true, 0);

      writeLock.release();

      expectReadWriteLock(lock, false, false, 0);
    });

    test("acquire multiple with read lock", async () => {
      const lock = new ReadWriteLock();
      expectReadWriteLock(lock, false, false, 0);

      const readLock = await lock.acquireReadLock();

      expectReadWriteLock(lock, true, false, 1);

      const writeLockPromises: Promise<WriteLock>[] = [];
      for (let i = 0; i < 10; i++) {
        writeLockPromises.push(lock.acquireWriteLock());
      }

      expectReadWriteLock(lock, true, false, 1, 0, 10);

      setTimeout(() => readLock.release(), 50);

      let writeLock = await expectDurationBetween(50, 100, () => writeLockPromises.shift()!);

      while (writeLockPromises.length > 0) {
        expectReadWriteLock(lock, false, true, 0, 0, writeLockPromises.length);

        setTimeout(() => writeLock.release(), 50);

        writeLock = await expectDurationBetween(50, 100, () => writeLockPromises.shift()!);
      }

      expectReadWriteLock(lock, false, true, 0);

      writeLock.release();

      expectReadWriteLock(lock, false, false, 0);
    });
  });

  describe("with timeout", () => {
    describe("multiple without locks", () => {
      test.each([0, -1])("with non-positive timeout %d", async (timeout) => {
        const lock = new ReadWriteLock();
        expectReadWriteLock(lock, false, false, 0);

        const writeLockPromises: Promise<WriteLock | false>[] = [];
        for (let i = 0; i < 10; i++) {
          writeLockPromises.push(lock.acquireWriteLock(timeout).catch(() => false));
        }

        expectReadWriteLock(lock, false, true, 0, 0, 0);

        const result = await expectResolvedImmediately(() => Promise.all(writeLockPromises));

        const writeLock = result.shift()!;

        expect(writeLock).not.toBe(false);
        expect(result).toStrictEqual(Array(9).fill(false));

        (writeLock as WriteLock).release();

        expectReadWriteLock(lock, false, false, 0);
      });

      test("not available within timeout", async () => {
        const lock = new ReadWriteLock();
        expectReadWriteLock(lock, false, false, 0);

        const writeLockPromises: Promise<WriteLock | false>[] = [];
        for (let i = 0; i < 10; i++) {
          writeLockPromises.push(lock.acquireWriteLock(50).catch(() => false));
        }

        expectReadWriteLock(lock, false, true, 0, 0, 9);

        const result = await expectDurationBetween(50, 100, () => Promise.all(writeLockPromises));

        const writeLock = result.shift()!;

        expect(writeLock).not.toBe(false);
        expect(result).toStrictEqual(Array(9).fill(false));

        (writeLock as WriteLock).release();

        expectReadWriteLock(lock, false, false, 0);
      });

      test("available within timeout", async () => {
        const lock = new ReadWriteLock();
        expectReadWriteLock(lock, false, false, 0);

        const writeLockPromises: Promise<WriteLock>[] = [];
        for (let i = 0; i < 10; i++) {
          writeLockPromises.push(lock.acquireWriteLock(200));
        }

        expectReadWriteLock(lock, false, true, 0, 0, 9);

        let writeLock = await expectResolvedImmediately(() => writeLockPromises.shift()!);

        while (writeLockPromises.length > 0) {
          expectReadWriteLock(lock, false, true, 0, 0, writeLockPromises.length);

          setTimeout(() => writeLock.release(), 5);

          writeLock = await expectDurationBetween(5, 25, () => writeLockPromises.shift()!);
        }

        expectReadWriteLock(lock, false, true, 0);

        writeLock.release();

        expectReadWriteLock(lock, false, false, 0);
      });
    });

    describe("acquire multiple with read lock", () => {
      test.each([0, -1])("with non-positive timeout %d", async (timeout) => {
        const lock = new ReadWriteLock();
        expectReadWriteLock(lock, false, false, 0);

        const readLock = await lock.acquireReadLock();

        expectReadWriteLock(lock, true, false, 1);

        const writeLockResultPromises: Promise<WriteLock | false>[] = [];
        for (let i = 0; i < 10; i++) {
          writeLockResultPromises.push(lock.acquireWriteLock(timeout).catch(() => false));
        }

        expectReadWriteLock(lock, true, false, 1, 0, 0);

        const result = await expectResolvedImmediately(() => Promise.all(writeLockResultPromises));

        expect(result).toStrictEqual(Array(10).fill(false));

        readLock.release();

        expectReadWriteLock(lock, false, false, 0);
      });

      test("not available within timeout", async () => {
        const lock = new ReadWriteLock();
        expectReadWriteLock(lock, false, false, 0);

        const readLock = await lock.acquireReadLock();

        expectReadWriteLock(lock, true, false, 1);

        const writeLockResultPromises: Promise<WriteLock | false>[] = [];
        for (let i = 0; i < 10; i++) {
          writeLockResultPromises.push(lock.acquireWriteLock(50).catch(() => false));
        }

        expectReadWriteLock(lock, true, false, 1, 0, 10);

        const result = await expectDurationBetween(50, 100, () => Promise.all(writeLockResultPromises));

        expect(result).toStrictEqual(Array(10).fill(false));

        readLock.release();

        expectReadWriteLock(lock, false, false, 0);
      });

      test("available within timeout", async () => {
        const lock = new ReadWriteLock();
        expectReadWriteLock(lock, false, false, 0);

        const readLock = await lock.acquireReadLock();

        expectReadWriteLock(lock, true, false, 1);

        const writeLockPromises: Promise<WriteLock>[] = [];
        for (let i = 0; i < 10; i++) {
          writeLockPromises.push(lock.acquireWriteLock(200));
        }

        expectReadWriteLock(lock, true, false, 1, 0, 10);

        setTimeout(() => readLock.release(), 50);

        let writeLock = await expectDurationBetween(50, 100, () => writeLockPromises.shift()!);

        while (writeLockPromises.length > 0) {
          expectReadWriteLock(lock, false, true, 0, 0, writeLockPromises.length);

          setTimeout(() => writeLock.release(), 5);

          writeLock = await expectDurationBetween(5, 25, () => writeLockPromises.shift()!);
        }

        expectReadWriteLock(lock, false, true, 0);

        writeLock.release();

        expectReadWriteLock(lock, false, false, 0);
      });
    });
  });
});

describe("release write lock", () => {
  test("no longer held", async () => {
    const lock = new ReadWriteLock();
    expectReadWriteLock(lock, false, false, 0);

    const writeLock = await lock.acquireWriteLock();

    expect(writeLock.isHeld()).toBe(true);

    writeLock.release();

    expect(writeLock.isHeld()).toBe(false);
    expect(() => writeLock.release()).toThrow("Write lock is no longer held");
  });
});

describe("release mixed locks", () => {
  test("fair", async () => {
    const lock = new ReadWriteLock();
    expectReadWriteLock(lock, false, false, 0);

    const readLockPromises: Promise<ReadLock>[] = [];
    const writeLockPromises: Promise<WriteLock>[] = [];
    for (let i = 0; i < 10; i++) {
      readLockPromises.push(lock.acquireReadLock());
      writeLockPromises.push(lock.acquireWriteLock());
    }

    expectReadWriteLock(lock, true, false, 1, 9, 10);

    for (let i = 10; i > 1; i--) {
      (await readLockPromises.shift()!).release();

      expectReadWriteLock(lock, false, true, 0, i - 1, i - 1);

      (await writeLockPromises.shift()!).release();

      expectReadWriteLock(lock, true, false, 1, i - 2, i - 1);
    }

    (await readLockPromises.shift()!).release();

    expectReadWriteLock(lock, false, true, 0, 0, 0);

    (await writeLockPromises.shift()!).release();

    expectReadWriteLock(lock, false, false, 0, 0, 0);
  });

  test("non-fair", async () => {
    const lock = new ReadWriteLock({
      fair: false,
    });
    expectReadWriteLock(lock, false, false, 0);

    const readLockPromises: Promise<ReadLock>[] = [];
    const writeLockPromises: Promise<WriteLock>[] = [];
    for (let i = 0; i < 10; i++) {
      readLockPromises.push(lock.acquireReadLock());
      writeLockPromises.push(lock.acquireWriteLock());
    }

    expectReadWriteLock(lock, true, false, 10, 0, 10);

    for (let i = 10; i > 1; i--) {
      (await readLockPromises.shift()!).release();

      expectReadWriteLock(lock, true, false, i - 1, 0, 10);
    }

    (await readLockPromises.shift()!).release();

    for (let i = 10; i > 1; i--) {
      expectReadWriteLock(lock, false, true, 0, 0, i - 1);

      (await writeLockPromises.shift()!).release();
    }

    expectReadWriteLock(lock, false, true, 0, 0, 0);

    (await writeLockPromises.shift()!).release();

    expectReadWriteLock(lock, false, false, 0, 0, 0);
  });
});

describe("upgrade to write lock", () => {
  test("no longer held", async () => {
    const lock = new ReadWriteLock();
    expectReadWriteLock(lock, false, false, 0);

    const readLock = await lock.acquireReadLock();

    expect(readLock.isHeld()).toBe(true);

    readLock.release();

    expect(readLock.isHeld()).toBe(false);
    expect(() => readLock.upgradeToWriteLock()).toThrow("Read lock is no longer held");
  });

  describe("without timeout", () => {
    test("no other locks", async () => {
      const lock = new ReadWriteLock();
      expectReadWriteLock(lock, false, false, 0);

      const readLock = await lock.acquireReadLock();

      expectReadWriteLock(lock, true, false, 1);

      const writeLock = await expectResolvedImmediately(() => readLock.upgradeToWriteLock());

      expect(readLock.isHeld()).toBe(false);

      expectReadWriteLock(lock, false, true, 0);

      writeLock.release();

      expectReadWriteLock(lock, false, false, 0);
    });

    test("other read locks held", async () => {
      const lock = new ReadWriteLock();
      expectReadWriteLock(lock, false, false, 0);

      const readLock = await lock.acquireReadLock();
      const otherReadLock = await lock.acquireReadLock();

      expectReadWriteLock(lock, true, false, 2);

      const upgradePromise = readLock.upgradeToWriteLock();

      expect(readLock.isHeld()).toBe(false);

      expectReadWriteLock(lock, true, false, 1, 0, 1);

      setTimeout(async () => (await otherReadLock).release(), 50);

      const writeLock = await expectDurationBetween(50, 100, () => upgradePromise);

      expectReadWriteLock(lock, false, true, 0);

      writeLock.release();

      expectReadWriteLock(lock, false, false, 0);
    });

    test("write lock pending", async () => {
      const lock = new ReadWriteLock();
      expectReadWriteLock(lock, false, false, 0);

      const readLock = await lock.acquireReadLock();
      const writeLockPromise = lock.acquireWriteLock();

      expectReadWriteLock(lock, true, false, 1, 0, 1);

      const upgradePromise = readLock.upgradeToWriteLock();

      expect(readLock.isHeld()).toBe(false);

      expectReadWriteLock(lock, false, true, 0, 0, 1);

      setTimeout(async () => (await writeLockPromise).release(), 50);

      const writeLock = await expectDurationBetween(50, 100, () => upgradePromise);

      expectReadWriteLock(lock, false, true, 0);

      writeLock.release();

      expectReadWriteLock(lock, false, false, 0);
    });
  });

  describe("without timeout", () => {
    test("no other locks", async () => {
      const lock = new ReadWriteLock();
      expectReadWriteLock(lock, false, false, 0);

      const readLock = await lock.acquireReadLock();

      expectReadWriteLock(lock, true, false, 1);

      const writeLock = await expectResolvedImmediately(() => readLock.upgradeToWriteLock(100));

      expect(readLock.isHeld()).toBe(false);

      expectReadWriteLock(lock, false, true, 0);

      writeLock.release();

      expectReadWriteLock(lock, false, false, 0);
    });

    describe("upgraded within timeout", () => {
      test("other read locks held", async () => {
        const lock = new ReadWriteLock();
        expectReadWriteLock(lock, false, false, 0);

        const readLock = await lock.acquireReadLock();
        const otherReadLock = await lock.acquireReadLock();

        expectReadWriteLock(lock, true, false, 2);

        const upgradePromise = readLock.upgradeToWriteLock();

        expect(readLock.isHeld()).toBe(false);

        expectReadWriteLock(lock, true, false, 1, 0, 1);

        setTimeout(async () => (await otherReadLock).release(), 50);

        const writeLock = await expectDurationBetween(50, 100, () => upgradePromise);

        expectReadWriteLock(lock, false, true, 0);

        writeLock.release();

        expectReadWriteLock(lock, false, false, 0);
      });

      test("write lock pending", async () => {
        const lock = new ReadWriteLock();
        expectReadWriteLock(lock, false, false, 0);

        const readLock = await lock.acquireReadLock();
        const writeLockPromise = lock.acquireWriteLock();

        expectReadWriteLock(lock, true, false, 1, 0, 1);

        const upgradePromise = readLock.upgradeToWriteLock();

        expect(readLock.isHeld()).toBe(false);

        expectReadWriteLock(lock, false, true, 0, 0, 1);

        setTimeout(async () => (await writeLockPromise).release(), 50);

        const writeLock = await expectDurationBetween(50, 100, () => upgradePromise);

        expectReadWriteLock(lock, false, true, 0);

        writeLock.release();

        expectReadWriteLock(lock, false, false, 0);
      });
    });

    describe.each([0, -1])("with non-positive timeout %d", (timeout) => {
      test("no other locks held", async () => {
        const lock = new ReadWriteLock();
        expectReadWriteLock(lock, false, false, 0);

        const readLock = await lock.acquireReadLock();
        const otherReadLock = await lock.acquireReadLock();

        expectReadWriteLock(lock, true, false, 2);

        const result = await expectResolvedImmediately(() => readLock.upgradeToWriteLock(timeout).catch(() => false));

        expect(result).toBe(false);
        expect(readLock.isHeld()).toBe(false);

        expectReadWriteLock(lock, true, false, 1);

        otherReadLock.release();

        expectReadWriteLock(lock, false, false, 0);
      });

      test("other read locks held", async () => {
        const lock = new ReadWriteLock();
        expectReadWriteLock(lock, false, false, 0);

        const readLock = await lock.acquireReadLock();
        const otherReadLock = await lock.acquireReadLock();

        expectReadWriteLock(lock, true, false, 2);

        const result = await expectResolvedImmediately(() => readLock.upgradeToWriteLock(timeout).catch(() => false));

        expect(result).toBe(false);
        expect(readLock.isHeld()).toBe(false);

        expectReadWriteLock(lock, true, false, 1);

        otherReadLock.release();

        expectReadWriteLock(lock, false, false, 0);
      });

      test("write locks held", async () => {
        const lock = new ReadWriteLock();
        expectReadWriteLock(lock, false, false, 0);

        const readLock = await lock.acquireReadLock();
        const writeLockPromise = lock.acquireWriteLock();

        expectReadWriteLock(lock, true, false, 1, 0, 1);

        const result = await expectResolvedImmediately(() => readLock.upgradeToWriteLock(timeout).catch(() => false));

        expect(result).toBe(false);
        expect(readLock.isHeld()).toBe(false);

        expectReadWriteLock(lock, false, true, 0);

        const writeLock = await writeLockPromise;
        writeLock.release();

        expectReadWriteLock(lock, false, false, 0);
      });
    });

    describe("not upgraded without timeout", () => {
      test("other read locks held", async () => {
        const lock = new ReadWriteLock();
        expectReadWriteLock(lock, false, false, 0);

        const readLock = await lock.acquireReadLock();
        const otherReadLock = await lock.acquireReadLock();

        expectReadWriteLock(lock, true, false, 2);

        const upgradePromise = readLock.upgradeToWriteLock(10);

        expect(readLock.isHeld()).toBe(false);

        expectReadWriteLock(lock, true, false, 1, 0, 1);

        const result = await expectDurationBetween(10, 25, () => upgradePromise.catch(() => false));

        expect(result).toBe(false);
        expectReadWriteLock(lock, true, false, 1);

        otherReadLock.release();

        expectReadWriteLock(lock, false, false, 0);
      });

      test("write lock pending", async () => {
        const lock = new ReadWriteLock();
        expectReadWriteLock(lock, false, false, 0);

        const readLock = await lock.acquireReadLock();
        const writeLockPromise = lock.acquireWriteLock();

        expectReadWriteLock(lock, true, false, 1, 0, 1);

        const upgradePromise = readLock.upgradeToWriteLock(10);

        expect(readLock.isHeld()).toBe(false);

        expectReadWriteLock(lock, false, true, 0, 0, 1);

        const result = await expectDurationBetween(10, 25, () => upgradePromise.catch(() => false));

        expect(result).toBe(false);
        expectReadWriteLock(lock, false, true, 0);

        const writeLock = await writeLockPromise;
        writeLock.release();

        expectReadWriteLock(lock, false, false, 0);
      });
    });
  });
});

describe("downgrade to read lock", () => {
  test("no longer held", async () => {
    const lock = new ReadWriteLock();
    expectReadWriteLock(lock, false, false, 0);

    const writeLock = await lock.acquireWriteLock();

    expect(writeLock.isHeld()).toBe(true);

    writeLock.release();

    expect(writeLock.isHeld()).toBe(false);
    expect(() => writeLock.downgradeToReadLock()).toThrow("Write lock is no longer held");
  });

  test("fair", async () => {
    const lock = new ReadWriteLock();
    expectReadWriteLock(lock, false, false, 0);

    const writeLockPromises: Promise<WriteLock>[] = [];
    const readLockPromises: Promise<ReadLock>[] = [];
    for (let i = 0; i < 10; i++) {
      writeLockPromises.push(lock.acquireWriteLock());
      readLockPromises.push(lock.acquireReadLock());
    }

    expectReadWriteLock(lock, false, true, 0, 10, 9);

    for (let i = 10; i > 1; i--) {
      const writeLock = await writeLockPromises.shift()!;

      const readLock = writeLock.downgradeToReadLock();

      expect(writeLock.isHeld()).toBe(false);

      expectReadWriteLock(lock, true, false, 2, i - 1, i - 1);

      readLock.release();

      expectReadWriteLock(lock, true, false, 1, i - 1, i - 1);

      (await readLockPromises.shift()!).release();

      expectReadWriteLock(lock, false, true, 0, i - 1, i - 2);
    }

    const writeLock = await writeLockPromises.shift()!;

    const readLock = writeLock.downgradeToReadLock();

    expect(writeLock.isHeld()).toBe(false);

    expectReadWriteLock(lock, true, false, 2, 0, 0);

    readLock.release();

    expectReadWriteLock(lock, true, false, 1, 0, 0);

    (await readLockPromises.shift()!).release();

    expectReadWriteLock(lock, false, false, 0, 0, 0);
  });

  test("non-fair", async () => {
    const lock = new ReadWriteLock({
      fair: false,
    });
    expectReadWriteLock(lock, false, false, 0);

    const writeLockPromises: Promise<WriteLock>[] = [];
    const readLockPromises: Promise<ReadLock>[] = [];
    for (let i = 0; i < 10; i++) {
      writeLockPromises.push(lock.acquireWriteLock());
      readLockPromises.push(lock.acquireReadLock());
    }

    expectReadWriteLock(lock, false, true, 0, 10, 9);

    let readLock = (await writeLockPromises.shift()!).downgradeToReadLock();

    expectReadWriteLock(lock, true, false, 11, 0, 9);

    for (let i = 10; i > 0; i--) {
      readLock.release();

      readLock = await readLockPromises.shift()!;

      expectReadWriteLock(lock, true, false, i, 0, 9);
    }

    readLock.release();

    expectReadWriteLock(lock, false, true, 0, 0, 8);

    for (let i = 9; i > 1; i--) {
      readLock = (await writeLockPromises.shift()!).downgradeToReadLock();

      expectReadWriteLock(lock, true, false, 1, 0, i - 1);

      readLock.release();

      expectReadWriteLock(lock, false, true, 0, 0, i - 2);
    }

    readLock = (await writeLockPromises.shift()!).downgradeToReadLock();

    expectReadWriteLock(lock, true, false, 1, 0, 0);

    readLock.release();

    expectReadWriteLock(lock, false, false, 0, 0, 0);
  });
});

describe("toString", () => {
  test("no lock held", () => {
    const lock = new ReadWriteLock();
    expect(lock.toString()).toBe("ReadWriteLock[write lock=false, read locks=0]");
  });

  test.each([
    [1, "ReadWriteLock[write lock=false, read locks=1]"],
    [2, "ReadWriteLock[write lock=false, read locks=2]"],
  ])("%d read lock(s) held", async (lockCount, stringValue) => {
    const lock = new ReadWriteLock();

    const readLockPromises: Promise<ReadLock>[] = [];
    for (let i = 0; i < lockCount; i++) {
      readLockPromises.push(lock.acquireReadLock());
    }

    expect(lock.toString()).toBe(stringValue);

    const readLocks = await Promise.all(readLockPromises);

    readLocks.forEach((readLock) => {
      expect(readLock.toString()).toBe("ReadLock[held=true]");

      readLock.release();

      expect(readLock.toString()).toBe("ReadLock[held=false]");
    });
  });

  test("write lock held", async () => {
    const lock = new ReadWriteLock();

    const writeLock = await lock.acquireWriteLock();

    expect(lock.toString()).toBe("ReadWriteLock[write lock=true, read locks=0]");

    expect(writeLock.toString()).toBe("WriteLock[held=true]");

    writeLock.release();

    expect(writeLock.toString()).toBe("WriteLock[held=false]");
  });
});

test("example", async () => {
  class CachedData {
    private data = 0;
    private cacheValid = false;
    private lock = new ReadWriteLock();

    async processCachedData(): Promise<number> {
      let readLock = await this.lock.acquireReadLock();
      if (!this.cacheValid) {
        // Unlike in Java, locks can be upgraded directly
        // Unlike in .NET, any read lock can be upgraded
        const writeLock = await readLock.upgradeToWriteLock();
        try {
          // Recheck state because another invocation might have acquired the write lock
          // and changed data before the upgrade has completed.
          if (!this.cacheValid) {
            this.data++;
            this.cacheValid = true;
          }
        } finally {
          readLock = writeLock.downgradeToReadLock();
        }
      }
      try {
        return this.data!;
      } finally {
        readLock.release();
      }
    }
  }

  const cachedData = new CachedData();

  let value = await cachedData.processCachedData();

  expect(value).toBe(1);

  value = await cachedData.processCachedData();

  expect(value).toBe(1);
});
