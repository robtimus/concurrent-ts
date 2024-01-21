import { performance } from "perf_hooks";

async function expectDuration<T>(func: () => Promise<T>, expectation: (duration: number) => void): Promise<T> {
  const promise = func();

  const start = performance.now();
  const result = await promise;
  const end = performance.now();

  expectation(end - start);

  return result;
}

export async function expectDurationAtLeast<T>(minDuration: number, func: () => Promise<T>): Promise<T> {
  return expectDuration(func, (duration) => expect(duration).toBeGreaterThanOrEqual(minDuration));
}

export async function expectDurationAtMost<T>(maxDuration: number, func: () => Promise<T>): Promise<T> {
  return expectDuration(func, (duration) => expect(duration).toBeLessThanOrEqual(maxDuration));
}

export async function expectResolvedImmediately<T>(func: () => Promise<T>): Promise<T> {
  // cannot guarantee that this occurs immediately, so use a very small max duration
  return expectDurationAtMost(2, func);
}

export async function expectDurationBetween<T>(minDuration: number, maxDuration: number, func: () => Promise<T>): Promise<T> {
  return expectDuration(func, (duration) => {
    expect(duration).toBeGreaterThanOrEqual(minDuration);
    expect(duration).toBeLessThanOrEqual(maxDuration);
  });
}
