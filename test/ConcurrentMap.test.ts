import { ConcurrentMap, CountDownLatch } from "../src";

const keys = [0, 1, 2, 3, 4];

describe("size", () => {
  test("without running actions", async () => {
    const map = new ConcurrentMap<number, number>();

    for (const k of keys) {
      expect(map.size).toBe(k);

      await map.set(k, k * 2);
    }

    expect(map.size).toBe(keys.length);
  });

  test("with running actions", async () => {
    const map = new ConcurrentMap<number, number>();

    const latch = new CountDownLatch(1);

    const promises = keys.map((k) => map.computeIfAbsent(k, () => latch.await().then(() => k + 10)));

    expect(map.size).toBe(0);

    latch.countDown();

    await Promise.all(promises);

    expect(map.size).toBe(keys.length);
  });
});

describe("get", () => {
  test("without running actions", async () => {
    const map = new ConcurrentMap<number, number>();

    for (const k of keys) {
      expect(map.get(k)).toBeUndefined();

      await map.set(k, k * 2);

      expect(map.get(k)).toBe(k * 2);
    }
  });

  describe("with running actions", () => {
    test("without existing values", async () => {
      const map = new ConcurrentMap<number, number>();

      const latch = new CountDownLatch(1);

      const promises = keys.map((k) => map.compute(k, () => latch.await().then(() => k + 10)));

      keys.forEach((k) => expect(map.get(k)).toBeUndefined());

      latch.countDown();

      await Promise.all(promises);

      keys.forEach((k) => expect(map.get(k)).toBe(k + 10));
    });

    test("with existing values", async () => {
      const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

      const latch = new CountDownLatch(1);

      const promises = keys.map((k) => map.compute(k, () => latch.await().then(() => k + 10)));

      keys.forEach((k) => expect(map.get(k)).toBe(k * 2));

      latch.countDown();

      await Promise.all(promises);

      keys.forEach((k) => expect(map.get(k)).toBe(k + 10));
    });
  });
});

describe("getLatest", () => {
  test("without running actions", async () => {
    const map = new ConcurrentMap<number, number>();

    for (const k of keys) {
      expect(await map.getLatest(k)).toBeUndefined();

      await map.set(k, k * 2);

      expect(await map.getLatest(k)).toBe(k * 2);
    }
  });

  describe("with running actions", () => {
    test("without existing values", async () => {
      const map = new ConcurrentMap<number, number>();

      const latch = new CountDownLatch(1);

      keys.map((k) => map.compute(k, () => latch.await().then(() => k + 10)));

      const promises = keys.map((k) => map.getLatest(k));

      latch.countDown();

      const values = await Promise.all(promises);

      keys.forEach((k) => expect(values[k]).toBe(k + 10));
    });

    test("with existing values", async () => {
      const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

      const latch = new CountDownLatch(1);

      keys.map((k) => map.compute(k, () => latch.await().then(() => k + 10)));

      keys.forEach((k) => expect(map.get(k)).toBe(k * 2));

      const promises = keys.map((k) => map.getLatest(k));

      latch.countDown();

      const values = await Promise.all(promises);

      keys.forEach((k) => expect(values[k]).toBe(k + 10));
    });
  });
});

describe("has", () => {
  test("without running actions", async () => {
    const map = new ConcurrentMap<number, number>();

    for (let k = 0; k < 10; k++) {
      expect(map.has(k)).toBe(false);

      await map.set(k, k * 2);

      expect(map.has(k)).toBe(true);
    }
  });

  describe("with running actions", () => {
    test("without existing values", async () => {
      const map = new ConcurrentMap<number, number>();

      const latch = new CountDownLatch(1);

      const promises = keys.map((k) => map.compute(k, () => latch.await().then(() => k + 10)));

      keys.forEach((k) => expect(map.has(k)).toBe(false));

      latch.countDown();

      await Promise.all(promises);

      keys.forEach((k) => expect(map.has(k)).toBe(true));
    });

    test("with existing values", async () => {
      const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

      const latch = new CountDownLatch(1);

      const promises = keys.map((k) => map.compute(k, () => latch.await().then(() => k + 10)));

      keys.forEach((k) => expect(map.has(k)).toBe(true));

      latch.countDown();

      await Promise.all(promises);

      keys.forEach((k) => expect(map.has(k)).toBe(true));
    });
  });
});

describe("set", () => {
  describe("without existing value", () => {
    test("without running actions", async () => {
      const map = new ConcurrentMap<number, number>();

      const oldValues = await Promise.all(keys.map((k) => map.set(k, k * 2)));

      keys.forEach((k) => expect(oldValues[k]).toBeUndefined());

      keys.forEach((k) => expect(map.get(k)).toBe(k * 2));
    });

    test("with running actions", async () => {
      const map = new ConcurrentMap<number, number>();

      const latch = new CountDownLatch(1);

      keys.map((k) => map.compute(k, () => latch.await().then(() => k + 10)));

      const promises = keys.map((k) => map.set(k, k * 2));

      keys.forEach((k) => expect(map.has(k)).toBe(false));

      latch.countDown();

      const oldValues = await Promise.all(promises);

      keys.forEach((k) => expect(oldValues[k]).toBe(k + 10));

      keys.forEach((k) => expect(map.get(k)).toBe(k * 2));
    });
  });

  describe("with existing value", () => {
    test("without running actions", async () => {
      const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

      const oldValues = await Promise.all(keys.map((k) => map.set(k, k + 10)));

      keys.forEach((k) => expect(oldValues[k]).toBe(k * 2));

      keys.forEach((k) => expect(map.get(k)).toBe(k + 10));
    });

    test("with running actions", async () => {
      const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

      const latch = new CountDownLatch(1);

      keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

      const promises = keys.map((k) => map.set(k, k + 10));

      keys.forEach((k) => expect(map.has(k)).toBe(true));

      latch.countDown();

      const oldValues = await Promise.all(promises);

      keys.forEach((k) => expect(oldValues[k]).toBe(k - 5));

      keys.forEach((k) => expect(map.get(k)).toBe(k + 10));
    });
  });
});

describe("delete", () => {
  describe("any value", () => {
    describe("not present", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap<number, number>();

        const deleted = await Promise.all(keys.map((k) => map.delete(k)));

        keys.forEach((k) => expect(deleted[k]).toBeUndefined());
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

        // don't await the result
        map.clear();

        const promises = keys.map((k) => map.delete(k));

        latch.countDown();

        const deleted = await Promise.all(promises);

        keys.forEach((k) => expect(deleted[k]).toBeUndefined());
      });
    });

    describe("present", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const deleted = await Promise.all(keys.map((k) => map.delete(k)));

        keys.forEach((k) => expect(deleted[k]).toBe(k * 2));
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap<number, number>();

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => k + 10));

        const promises = keys.map((k) => map.delete(k));

        latch.countDown();

        const deleted = await Promise.all(promises);

        keys.forEach((k) => expect(deleted[k]).toBe(k + 10));
      });
    });
  });

  describe("specific value", () => {
    describe("not present", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap<number, number>();

        const deleted = await Promise.all(keys.map((k) => map.delete(k, k * 2)));

        keys.forEach((k) => expect(deleted[k]).toBe(false));
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

        // don't await the result
        map.clear();

        const promises = keys.map((k) => map.delete(k, k * 2));

        latch.countDown();

        const deleted = await Promise.all(promises);

        keys.forEach((k) => expect(deleted[k]).toBe(false));
      });
    });

    describe("different value present", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const deleted = await Promise.all(keys.map((k) => map.delete(k, k + 10)));

        keys.forEach((k) => expect(deleted[k]).toBe(false));

        keys.forEach((k) => expect(map.get(k)).toBe(k * 2));
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k + 10)));

        const promises = keys.map((k) => map.delete(k, k * 2));

        latch.countDown();

        const deleted = await Promise.all(promises);

        keys.forEach((k) => expect(deleted[k]).toBe(false));

        keys.forEach((k) => expect(map.get(k)).toBe(k + 10));
      });
    });

    describe("same value present", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const deleted = await Promise.all(keys.map((k) => map.delete(k, k * 2)));

        keys.forEach((k) => expect(deleted[k]).toBe(true));

        keys.forEach((k) => expect(map.get(k)).toBeUndefined());
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k + 10)));

        const promises = keys.map((k) => map.delete(k, k + 10));

        latch.countDown();

        const deleted = await Promise.all(promises);

        keys.forEach((k) => expect(deleted[k]).toBe(true));

        keys.forEach((k) => expect(map.get(k)).toBeUndefined());
      });
    });
  });
});

describe("clear", () => {
  test("empty", async () => {
    const map = new ConcurrentMap<number, number>();

    const promise = map.clear();

    expect(map.size).toBe(0);

    await promise;

    expect(map.size).toBe(0);
  });

  test("without running actions", async () => {
    const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

    expect(map.size).toBe(keys.length);

    const promise = map.clear();

    keys.forEach((k) => expect(map.has(k)).toBe(false));
    expect(map.size).toBe(0);

    await promise;

    expect(map.size).toBe(0);
  });

  test("with running actions", async () => {
    const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

    const latch = new CountDownLatch(1);

    keys.map((k) => map.compute(k, () => latch.await().then(() => k + 10)));

    expect(map.size).toBe(keys.length);

    const promise = map.clear();

    expect(map.size).toBe(keys.length);

    latch.countDown();

    await promise;

    keys.forEach((k) => expect(map.has(k)).toBe(false));
    expect(map.size).toBe(0);
  });

  test("both with and without running actions", async () => {
    const map = new ConcurrentMap(keys.map((k) => k + 10).map((k) => [k, k * 2]));

    const latch = new CountDownLatch(1);

    keys.map((k) => map.compute(k, () => latch.await().then(() => k + 10)));

    expect(map.size).toBe(keys.length);

    const promise = map.clear();

    // keys with +10 have been deleted already; keys without haven't been added yet
    expect(map.size).toBe(0);

    latch.countDown();

    keys.forEach((k) => expect(map.has(k + 10)).toBe(false));
    keys.forEach((k) => expect(map.has(k)).toBe(false));
    expect(map.size).toBe(0);

    await promise;

    keys.forEach((k) => expect(map.has(k + 10)).toBe(false));
    keys.forEach((k) => expect(map.has(k)).toBe(false));
    expect(map.size).toBe(0);
  });
});

describe("keys", () => {
  test("empty", () => {
    const map = new ConcurrentMap<number, number>();

    const iterator = map.keys();
    const next = iterator.next();
    expect(next.done).toBe(true);
    expect(next.value).toBe(undefined);
  });

  test("without running actions", async () => {
    const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

    const iterator = map.keys();
    for (const k of keys) {
      const next = iterator.next();
      expect(next.done).toBeFalsy();
      expect(next.value).toBe(k);
    }
    const next = iterator.next();
    expect(next.done).toBe(true);
    expect(next.value).toBeUndefined();
  });

  test("with running actions", async () => {
    const map = new ConcurrentMap(keys.map((k) => k + 10).map((k) => [k, k * 2]));

    const latch = new CountDownLatch(1);

    keys.map((k) => map.compute(k, () => latch.await().then(() => k + 10)));

    expect(map.size).toBe(keys.length);

    const iterator = map.keys();

    latch.countDown();

    for (const k of keys) {
      const next = iterator.next();
      expect(next.done).toBeFalsy();
      expect(next.value).toBe(k + 10);
    }
    const next = iterator.next();
    expect(next.done).toBe(true);
    expect(next.value).toBeUndefined();
  });
});

describe("values", () => {
  test("empty", () => {
    const map = new ConcurrentMap<number, number>();

    const iterator = map.values();
    const next = iterator.next();
    expect(next.done).toBe(true);
    expect(next.value).toBe(undefined);
  });

  test("without running actions", async () => {
    const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

    const iterator = map.values();
    for (const k of keys) {
      const next = iterator.next();
      expect(next.done).toBeFalsy();
      expect(next.value).toBe(k * 2);
    }
    const next = iterator.next();
    expect(next.done).toBe(true);
    expect(next.value).toBeUndefined();
  });

  test("with running actions", async () => {
    const map = new ConcurrentMap(keys.map((k) => k + 10).map((k) => [k, k * 2]));

    const latch = new CountDownLatch(1);

    keys.map((k) => map.compute(k, () => latch.await().then(() => k + 10)));

    expect(map.size).toBe(keys.length);

    const iterator = map.values();

    latch.countDown();

    for (const k of keys) {
      const next = iterator.next();
      expect(next.done).toBeFalsy();
      expect(next.value).toBe((k + 10) * 2);
    }
    const next = iterator.next();
    expect(next.done).toBe(true);
    expect(next.value).toBeUndefined();
  });
});

describe("entries", () => {
  test("empty", () => {
    const map = new ConcurrentMap<number, number>();

    const iterator = map.entries();
    const next = iterator.next();
    expect(next.done).toBe(true);
    expect(next.value).toBe(undefined);
  });

  test("without running actions", async () => {
    const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

    const iterator = map.entries();
    for (const k of keys) {
      const next = iterator.next();
      expect(next.done).toBeFalsy();
      expect(next.value).toStrictEqual([k, k * 2]);
    }
    const next = iterator.next();
    expect(next.done).toBe(true);
    expect(next.value).toBeUndefined();
  });

  test("with running actions", async () => {
    const map = new ConcurrentMap(keys.map((k) => k + 10).map((k) => [k, k * 2]));

    const latch = new CountDownLatch(1);

    keys.map((k) => map.compute(k, () => latch.await().then(() => k + 10)));

    expect(map.size).toBe(keys.length);

    const iterator = map.entries();

    latch.countDown();

    for (const k of keys) {
      const next = iterator.next();
      expect(next.done).toBeFalsy();
      expect(next.value).toStrictEqual([k + 10, (k + 10) * 2]);
    }
    const next = iterator.next();
    expect(next.done).toBe(true);
    expect(next.value).toBeUndefined();
  });
});

describe("iterator", () => {
  test("empty", () => {
    const map = new ConcurrentMap<number, number>();

    let count = 0;
    for (const entry of map) {
      expect(entry).toBeUndefined();
      count++;
    }
    expect(count).toBe(0);
  });

  test("without running actions", async () => {
    const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

    let count = 0;
    for (const entry of map) {
      expect(entry[1]).toBe(entry[0] * 2);
      count++;
    }
    expect(count).toBe(keys.length);
  });

  test("with running actions", async () => {
    const map = new ConcurrentMap(keys.map((k) => k + 10).map((k) => [k, k * 2]));

    const latch = new CountDownLatch(1);

    keys.map((k) => map.compute(k, () => latch.await().then(() => k + 10)));

    expect(map.size).toBe(keys.length);

    let count = 0;
    for (const entry of map) {
      expect(entry[1]).toBe(entry[0] * 2);
      count++;
    }
    expect(count).toBe(keys.length);

    latch.countDown();
  });
});

describe("setIfAbsent", () => {
  describe("without existing value", () => {
    test("without running actions", async () => {
      const map = new ConcurrentMap<number, number>();

      const oldValues = await Promise.all(keys.map((k) => map.setIfAbsent(k, k * 2)));

      keys.forEach((k) => expect(oldValues[k]).toBeUndefined());

      keys.forEach((k) => expect(map.get(k)).toBe(k * 2));
    });

    test("with running actions", async () => {
      const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

      const latch = new CountDownLatch(1);

      keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

      // don't await the result
      map.clear();

      const promises = keys.map((k) => map.setIfAbsent(k, k + 10));

      latch.countDown();

      const oldValues = await Promise.all(promises);

      keys.forEach((k) => expect(oldValues[k]).toBeUndefined());

      keys.forEach((k) => expect(map.get(k)).toBe(k + 10));
    });
  });

  describe("with existing value", () => {
    test("without running actions", async () => {
      const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

      const oldValues = await Promise.all(keys.map((k) => map.setIfAbsent(k, k + 10)));

      keys.forEach((k) => expect(oldValues[k]).toBe(k * 2));

      keys.forEach((k) => expect(map.get(k)).toBe(k * 2));
    });

    test("with running actions", async () => {
      const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

      const latch = new CountDownLatch(1);

      keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

      const promises = keys.map((k) => map.setIfAbsent(k, k + 10));

      keys.forEach((k) => expect(map.has(k)).toBe(true));

      latch.countDown();

      const oldValues = await Promise.all(promises);

      keys.forEach((k) => expect(oldValues[k]).toBe(k - 5));

      keys.forEach((k) => expect(map.get(k)).toBe(k - 5));
    });
  });
});

describe("setIfPresent", () => {
  describe("without existing value", () => {
    test("without running actions", async () => {
      const map = new ConcurrentMap<number, number>();

      const oldValues = await Promise.all(keys.map((k) => map.setIfPresent(k, k * 2)));

      keys.forEach((k) => expect(oldValues[k]).toBeUndefined());

      keys.forEach((k) => expect(map.has(k)).toBe(false));
      expect(map.size).toBe(0);
    });

    test("with running actions", async () => {
      const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

      const latch = new CountDownLatch(1);

      keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

      // don't await the result
      map.clear();

      const promises = keys.map((k) => map.setIfPresent(k, k + 10));

      latch.countDown();

      const oldValues = await Promise.all(promises);

      keys.forEach((k) => expect(oldValues[k]).toBeUndefined());

      keys.forEach((k) => expect(map.has(k)).toBe(false));
      expect(map.size).toBe(0);
    });
  });

  describe("with existing value", () => {
    test("without running actions", async () => {
      const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

      const oldValues = await Promise.all(keys.map((k) => map.setIfPresent(k, k + 10)));

      keys.forEach((k) => expect(oldValues[k]).toBe(k * 2));

      keys.forEach((k) => expect(map.get(k)).toBe(k + 10));
    });

    test("with running actions", async () => {
      const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

      const latch = new CountDownLatch(1);

      keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

      const promises = keys.map((k) => map.setIfPresent(k, k + 10));

      keys.forEach((k) => expect(map.has(k)).toBe(true));

      latch.countDown();

      const oldValues = await Promise.all(promises);

      keys.forEach((k) => expect(oldValues[k]).toBe(k - 5));

      keys.forEach((k) => expect(map.get(k)).toBe(k + 10));
    });
  });
});

describe("replace", () => {
  describe("not present", () => {
    test("without running actions", async () => {
      const map = new ConcurrentMap<number, number>();

      const replaced = await Promise.all(keys.map((k) => map.replace(k, k * 2, k + 10)));

      keys.forEach((k) => expect(replaced[k]).toBe(false));
    });

    test("with running actions", async () => {
      const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

      const latch = new CountDownLatch(1);

      keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

      // don't await the result
      map.clear();

      const promises = keys.map((k) => map.replace(k, k * 2, k + 10));

      latch.countDown();

      const replaced = await Promise.all(promises);

      keys.forEach((k) => expect(replaced[k]).toBe(false));
    });
  });

  describe("different value present", () => {
    test("without running actions", async () => {
      const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

      const replaced = await Promise.all(keys.map((k) => map.replace(k, k + 10, k - 5)));

      keys.forEach((k) => expect(replaced[k]).toBe(false));

      keys.forEach((k) => expect(map.get(k)).toBe(k * 2));
    });

    test("with running actions", async () => {
      const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

      const latch = new CountDownLatch(1);

      keys.map((k) => map.compute(k, () => latch.await().then(() => k + 10)));

      const promises = keys.map((k) => map.replace(k, k * 2, k - 5));

      latch.countDown();

      const replaced = await Promise.all(promises);

      keys.forEach((k) => expect(replaced[k]).toBe(false));

      keys.forEach((k) => expect(map.get(k)).toBe(k + 10));
    });
  });

  describe("same value present", () => {
    test("without running actions", async () => {
      const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

      const replaced = await Promise.all(keys.map((k) => map.replace(k, k * 2, k + 10)));

      keys.forEach((k) => expect(replaced[k]).toBe(true));

      keys.forEach((k) => expect(map.get(k)).toBe(k + 10));
    });

    test("with running actions", async () => {
      const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

      const latch = new CountDownLatch(1);

      keys.map((k) => map.compute(k, () => latch.await().then(() => k + 10)));

      const promises = keys.map((k) => map.replace(k, k + 10, k - 5));

      latch.countDown();

      const replaced = await Promise.all(promises);

      keys.forEach((k) => expect(replaced[k]).toBe(true));

      keys.forEach((k) => expect(map.get(k)).toBe(k - 5));
    });
  });
});

describe("computeIfAbsent", () => {
  describe("not present", () => {
    describe("returning undefined", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap<number, number>();

        const values = await Promise.all(keys.map((k) => map.computeIfAbsent(k, () => undefined)));

        keys.forEach((k) => expect(values[k]).toBeUndefined());

        keys.forEach((k) => expect(map.has(k)).toBe(false));
        expect(map.size).toBe(0);
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

        // don't await the result
        map.clear();

        const promises = keys.map((k) => map.computeIfAbsent(k, () => undefined));

        latch.countDown();

        const values = await Promise.all(promises);

        keys.forEach((k) => expect(values[k]).toBeUndefined());

        keys.forEach((k) => expect(map.has(k)).toBe(false));
        expect(map.size).toBe(0);
      });
    });

    describe("returning a value", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap<number, number>();

        const values = await Promise.all(keys.map((k) => map.computeIfAbsent(k, (i) => i + 10)));

        keys.forEach((k) => expect(values[k]).toBe(k + 10));

        keys.forEach((k) => expect(map.get(k)).toBe(k + 10));
        expect(map.size).toBe(keys.length);
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

        // don't await the result
        map.clear();

        const promises = keys.map((k) => map.computeIfAbsent(k, (i) => i + 10));

        latch.countDown();

        const values = await Promise.all(promises);

        keys.forEach((k) => expect(values[k]).toBe(k + 10));

        keys.forEach((k) => expect(map.get(k)).toBe(k + 10));
        expect(map.size).toBe(keys.length);
      });
    });
  });

  describe("present", () => {
    describe("returning undefined", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const values = await Promise.all(keys.map((k) => map.computeIfAbsent(k, () => undefined)));

        keys.forEach((k) => expect(values[k]).toBe(k * 2));

        keys.forEach((k) => expect(map.get(k)).toBe(k * 2));
        expect(map.size).toBe(keys.length);
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

        const promises = keys.map((k) => map.computeIfAbsent(k, () => undefined));

        latch.countDown();

        const values = await Promise.all(promises);

        keys.forEach((k) => expect(values[k]).toBe(k - 5));

        keys.forEach((k) => expect(map.get(k)).toBe(k - 5));
        expect(map.size).toBe(keys.length);
      });
    });

    describe("returning a value", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const values = await Promise.all(keys.map((k) => map.computeIfAbsent(k, (i) => i + 10)));

        keys.forEach((k) => expect(values[k]).toBe(k * 2));

        keys.forEach((k) => expect(map.get(k)).toBe(k * 2));
        expect(map.size).toBe(keys.length);
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

        const promises = keys.map((k) => map.computeIfAbsent(k, (i) => i + 10));

        latch.countDown();

        const values = await Promise.all(promises);

        keys.forEach((k) => expect(values[k]).toBe(k - 5));

        keys.forEach((k) => expect(map.get(k)).toBe(k - 5));
        expect(map.size).toBe(keys.length);
      });
    });
  });
});

describe("computeIfPresent", () => {
  describe("not present", () => {
    describe("returning undefined", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap<number, number>();

        const values = await Promise.all(keys.map((k) => map.computeIfPresent(k, () => undefined)));

        keys.forEach((k) => expect(values[k]).toBeUndefined());

        keys.forEach((k) => expect(map.has(k)).toBe(false));
        expect(map.size).toBe(0);
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

        // don't await the result
        map.clear();

        const promises = keys.map((k) => map.computeIfPresent(k, () => undefined));

        latch.countDown();

        const values = await Promise.all(promises);

        keys.forEach((k) => expect(values[k]).toBeUndefined());

        keys.forEach((k) => expect(map.has(k)).toBe(false));
        expect(map.size).toBe(0);
      });
    });

    describe("returning a value", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap<number, number>();

        const values = await Promise.all(keys.map((k) => map.computeIfPresent(k, (i) => i + 10)));

        keys.forEach((k) => expect(values[k]).toBeUndefined());

        keys.forEach((k) => expect(map.has(k)).toBe(false));
        expect(map.size).toBe(0);
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

        // don't await the result
        map.clear();

        const promises = keys.map((k) => map.computeIfPresent(k, (i) => i + 10));

        latch.countDown();

        const values = await Promise.all(promises);

        keys.forEach((k) => expect(values[k]).toBeUndefined());

        keys.forEach((k) => expect(map.has(k)).toBe(false));
        expect(map.size).toBe(0);
      });
    });
  });

  describe("present", () => {
    describe("returning undefined", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const values = await Promise.all(keys.map((k) => map.computeIfPresent(k, () => undefined)));

        keys.forEach((k) => expect(values[k]).toBeUndefined());

        keys.forEach((k) => expect(map.has(k)).toBe(false));
        expect(map.size).toBe(0);
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

        const promises = keys.map((k) => map.computeIfPresent(k, () => undefined));

        latch.countDown();

        const values = await Promise.all(promises);

        keys.forEach((k) => expect(values[k]).toBeUndefined());

        keys.forEach((k) => expect(map.has(k)).toBe(false));
        expect(map.size).toBe(0);
      });
    });

    describe("returning a value", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const values = await Promise.all(keys.map((k) => map.computeIfPresent(k, (i) => i + 10)));

        keys.forEach((k) => expect(values[k]).toBe(k + 10));

        keys.forEach((k) => expect(map.get(k)).toBe(k + 10));
        expect(map.size).toBe(keys.length);
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

        const promises = keys.map((k) => map.computeIfPresent(k, (i) => i + 10));

        latch.countDown();

        const values = await Promise.all(promises);

        keys.forEach((k) => expect(values[k]).toBe(k + 10));

        keys.forEach((k) => expect(map.get(k)).toBe(k + 10));
        expect(map.size).toBe(keys.length);
      });
    });
  });
});

describe("compute", () => {
  describe("not present", () => {
    describe("returning undefined", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap<number, number>();

        const values = await Promise.all(keys.map((k) => map.compute(k, () => undefined)));

        keys.forEach((k) => expect(values[k]).toBeUndefined());

        keys.forEach((k) => expect(map.has(k)).toBe(false));
        expect(map.size).toBe(0);
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

        // don't await the result
        map.clear();

        const promises = keys.map((k) => map.compute(k, () => undefined));

        latch.countDown();

        const values = await Promise.all(promises);

        keys.forEach((k) => expect(values[k]).toBeUndefined());

        keys.forEach((k) => expect(map.has(k)).toBe(false));
        expect(map.size).toBe(0);
      });
    });

    describe("returning a value", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap<number, number>();

        const values = await Promise.all(keys.map((k) => map.compute(k, (t, u) => t + (u ?? -100))));

        keys.forEach((k) => expect(values[k]).toBe(k - 100));

        keys.forEach((k) => expect(map.get(k)).toBe(k - 100));
        expect(map.size).toBe(keys.length);
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

        // don't await the result
        map.clear();

        const promises = keys.map((k) => map.compute(k, (t, u) => t + (u ?? -100)));

        latch.countDown();

        const values = await Promise.all(promises);

        keys.forEach((k) => expect(values[k]).toBe(k - 100));

        keys.forEach((k) => expect(map.get(k)).toBe(k - 100));
        expect(map.size).toBe(keys.length);
      });
    });
  });

  describe("present", () => {
    describe("returning undefined", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const values = await Promise.all(keys.map((k) => map.compute(k, () => undefined)));

        keys.forEach((k) => expect(values[k]).toBeUndefined());

        keys.forEach((k) => expect(map.has(k)).toBe(false));
        expect(map.size).toBe(0);
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

        const promises = keys.map((k) => map.compute(k, () => undefined));

        latch.countDown();

        const values = await Promise.all(promises);

        keys.forEach((k) => expect(values[k]).toBeUndefined());

        keys.forEach((k) => expect(map.has(k)).toBe(false));
        expect(map.size).toBe(0);
      });
    });

    describe("returning a value", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const values = await Promise.all(keys.map((k) => map.compute(k, (t, u) => t + (u ?? -100))));

        keys.forEach((k) => expect(values[k]).toBe(k + k * 2));

        keys.forEach((k) => expect(map.get(k)).toBe(k + k * 2));
        expect(map.size).toBe(keys.length);
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

        const promises = keys.map((k) => map.compute(k, (t, u) => t + (u ?? -100)));

        latch.countDown();

        const values = await Promise.all(promises);

        keys.forEach((k) => expect(values[k]).toBe(k + k - 5));

        keys.forEach((k) => expect(map.get(k)).toBe(k + k - 5));
        expect(map.size).toBe(keys.length);
      });
    });
  });
});

describe("merge", () => {
  describe("not present", () => {
    describe("returning undefined", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap<number, number>();

        const values = await Promise.all(keys.map((k) => map.merge(k, k + 10, () => undefined)));

        keys.forEach((k) => expect(values[k]).toBe(k + 10));

        keys.forEach((k) => expect(map.get(k)).toBe(k + 10));
        expect(map.size).toBe(keys.length);
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

        // don't await the result
        map.clear();

        const promises = keys.map((k) => map.merge(k, k + 10, () => undefined));

        latch.countDown();

        const values = await Promise.all(promises);

        keys.forEach((k) => expect(values[k]).toBe(k + 10));

        keys.forEach((k) => expect(map.get(k)).toBe(k + 10));
        expect(map.size).toBe(keys.length);
      });
    });

    describe("returning a value", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap<number, number>();

        const values = await Promise.all(keys.map((k) => map.merge(k, k + 10, (t, u) => t + (u ?? -100))));

        keys.forEach((k) => expect(values[k]).toBe(k + 10));

        keys.forEach((k) => expect(map.get(k)).toBe(k + 10));
        expect(map.size).toBe(keys.length);
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

        // don't await the result
        map.clear();

        const promises = keys.map((k) => map.merge(k, k + 10, (t, u) => t + (u ?? -100)));

        latch.countDown();

        const values = await Promise.all(promises);

        keys.forEach((k) => expect(values[k]).toBe(k + 10));

        keys.forEach((k) => expect(map.get(k)).toBe(k + 10));
        expect(map.size).toBe(keys.length);
      });
    });
  });

  describe("present", () => {
    describe("returning undefined", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const values = await Promise.all(keys.map((k) => map.merge(k, k + 10, () => undefined)));

        keys.forEach((k) => expect(values[k]).toBeUndefined());

        keys.forEach((k) => expect(map.has(k)).toBe(false));
        expect(map.size).toBe(0);
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

        const promises = keys.map((k) => map.merge(k, k + 10, () => undefined));

        latch.countDown();

        const values = await Promise.all(promises);

        keys.forEach((k) => expect(values[k]).toBeUndefined());

        keys.forEach((k) => expect(map.has(k)).toBe(false));
        expect(map.size).toBe(0);
      });
    });

    describe("returning a value", () => {
      test("without running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const values = await Promise.all(keys.map((k) => map.merge(k, k + 10, (t, u) => t + u)));

        keys.forEach((k) => expect(values[k]).toBe(k * 2 + k + 10));

        keys.forEach((k) => expect(map.get(k)).toBe(k * 2 + k + 10));
        expect(map.size).toBe(keys.length);
      });

      test("with running actions", async () => {
        const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

        const latch = new CountDownLatch(1);

        keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

        const promises = keys.map((k) => map.merge(k, k + 10, (t, u) => t + u));

        latch.countDown();

        const values = await Promise.all(promises);

        keys.forEach((k) => expect(values[k]).toBe(k - 5 + k + 10));

        keys.forEach((k) => expect(map.get(k)).toBe(k - 5 + k + 10));
        expect(map.size).toBe(keys.length);
      });
    });
  });
});

describe("forEach", () => {
  test("without running actions", async () => {
    const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

    const args: [number, number, ConcurrentMap<number, number>][] = [];
    map.forEach(function (v, k, m) {
      args.push([v, k, m]);
    });

    keys.forEach((k) => expect(args[k]).toStrictEqual([k * 2, k, map]));
  });

  test("with running actions", async () => {
    const map = new ConcurrentMap(keys.map((k) => [k, k * 2]));

    const latch = new CountDownLatch(1);

    const promises = keys.map((k) => map.compute(k, () => latch.await().then(() => k - 5)));

    const args: [number, number, ConcurrentMap<number, number>][] = [];
    map.forEach(function (v, k, m) {
      args.push([v, k, m]);
    });

    keys.forEach((k) => expect(args[k]).toStrictEqual([k * 2, k, map]));

    latch.countDown();

    await Promise.all(promises);
  });
});

test("example", async () => {
  class CachedData {
    private map = new ConcurrentMap<number, string>();
    public calculateCount = 0;

    async processCachedData(key: number): Promise<string> {
      return this.map.compute(key, (k, v) => {
        if (this.isValid(v)) {
          return v!;
        }
        return this.calculate(k);
      });
    }

    private isValid(value?: string): boolean {
      return value !== undefined;
    }

    private async calculate(key: number): Promise<string> {
      this.calculateCount++;
      return key.toString();
    }
  }

  const cachedData = new CachedData();

  let value = await cachedData.processCachedData(1);

  expect(value).toBe("1");
  expect(cachedData.calculateCount).toBe(1);

  value = await cachedData.processCachedData(1);

  expect(value).toBe("1");
  expect(cachedData.calculateCount).toBe(1);
});
