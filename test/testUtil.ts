const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;

let capturedTimeouts: number[];
let capturedTimers: { timer: NodeJS.Timeout; timeout: number }[];

const capturingSetTimeout = (callback: () => void, timeout: number): NodeJS.Timeout => {
  const timer = originalSetTimeout(() => {
    capturedTimeouts.push(timeout);
    callback();
    capturedTimers = capturedTimers.filter((t) => t.timer !== timer);
  }, timeout);
  capturedTimers.push({ timer, timeout });
  return timer;
};

const capturingClearTimeout = (timeoutId: NodeJS.Timeout): void => {
  capturedTimers = capturedTimers.filter((t) => t.timer !== timeoutId);
  originalClearTimeout(timeoutId);
};

export function captureTimeouts() {
  capturedTimeouts = [];
  capturedTimers = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.setTimeout = capturingSetTimeout as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.clearTimeout = capturingClearTimeout as any;
}

export function expectedCapturedTimeouts(...expectedTimeouts: number[]) {
  if (global.setTimeout === originalSetTimeout) {
    throw new Error("captureSetTimeout not called");
  }
  expect(capturedTimeouts).toStrictEqual(expectedTimeouts);
}

export function expectedRemainingTimeouts(...expectedTimeouts: number[]) {
  if (global.clearTimeout === originalClearTimeout) {
    throw new Error("captureSetTimeout not called");
  }
  const remainingTimeouts = capturedTimers.map((t) => t.timeout);
  expect(remainingTimeouts).toStrictEqual(expectedTimeouts);
}

export function clearCapturedTimeouts() {
  capturedTimeouts = [];
}

export function restoreTimeouts() {
  global.setTimeout = originalSetTimeout;
  global.clearTimeout = originalClearTimeout;
}
