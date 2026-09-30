import { afterEach, describe, expect, it, vi } from "vitest";
import { createOpeningSequence } from "../src/lib/opening";

afterEach(() => {
  vi.useRealTimers();
});
describe("opening animation lifecycle", () => {
  it("plays once, then reveals an already ready app after 320ms", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const sequence = createOpeningSequence(done);
    sequence.setReady(true);
    vi.advanceTimersByTime(319);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
    sequence.setReady(true);
    sequence.skip();
    vi.runAllTimers();
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("does not pretend initialization has completed", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const sequence = createOpeningSequence(done);
    sequence.skip();
    vi.advanceTimersByTime(1500);
    expect(done).not.toHaveBeenCalled();
    sequence.setReady(true);
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("fails open to the real loading/error UI instead of trapping users", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    createOpeningSequence(done);
    vi.advanceTimersByTime(3500);
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("reduced motion skips the decorative delay", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const sequence = createOpeningSequence(done, true);
    sequence.setReady(true);
    expect(done).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("responds immediately when reduced motion is enabled mid-intro", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const sequence = createOpeningSequence(done);
    sequence.setReady(true);
    sequence.setReducedMotion(true);
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("allows skipping and cleans up timers on unmount", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const sequence = createOpeningSequence(done);
    sequence.setReady(true);
    sequence.skip();
    expect(done).toHaveBeenCalledTimes(1);
    const disposed = vi.fn();
    createOpeningSequence(disposed).dispose();
    vi.runAllTimers();
    expect(disposed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
