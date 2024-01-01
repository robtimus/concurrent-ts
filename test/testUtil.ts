export async function expectDurationAtLeast<T>(minTime: number, func: () => Promise<T>): Promise<T> {
  const promise = func();

  const startTime = new Date();
  const result = await promise;
  const endTime = new Date();

  expect(endTime.getTime() - startTime.getTime()).toBeGreaterThanOrEqual(minTime);

  return result;
}

export async function expectDurationAtMost<T>(maxTime: number, func: () => Promise<T>): Promise<T> {
  const promise = func();

  const startTime = new Date();
  const result = await promise;
  const endTime = new Date();

  expect(endTime.getTime() - startTime.getTime()).toBeLessThanOrEqual(maxTime);

  return result;
}

export async function expectResolvedImmediately<T>(func: () => Promise<T>): Promise<T> {
  return expectDurationAtMost(0, func);
}

export async function expectDurationBetween<T>(minTime: number, maxTime: number, func: () => Promise<T>): Promise<T> {
  const promise = func();

  const startTime = new Date();
  const result = await promise;
  const endTime = new Date();

  expect(endTime.getTime() - startTime.getTime()).toBeGreaterThanOrEqual(minTime);
  expect(endTime.getTime() - startTime.getTime()).toBeLessThanOrEqual(maxTime);

  return result;
}
