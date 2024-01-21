async function expectDuration<T>(func: () => Promise<T>, expectation: (duration: number) => void): Promise<T> {
  const promise = func();

  const startTime = new Date();
  const result = await promise;
  const endTime = new Date();

  expectation(endTime.getTime() - startTime.getTime());

  return result;
}

export async function expectDurationAtLeast<T>(minDuration: number, func: () => Promise<T>): Promise<T> {
  // cannot guarantee that a setTimeout doesn't resolve just slightly early, so subtract 2ms
  return expectDuration(func, (duration) => expect(duration).toBeGreaterThanOrEqual(minDuration - 2));
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
    // cannot guarantee that a setTimeout doesn't resolve just slightly early, so subtract 2ms
    expect(duration).toBeGreaterThanOrEqual(minDuration - 2);
    expect(duration).toBeLessThanOrEqual(maxDuration);
  });
}
