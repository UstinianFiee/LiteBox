import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeClipboard } from "../src/lib/clipboard";

class Control {
  selectionStart = 2;
  selectionEnd = 5;
  selectionDirection = "forward";
  focus = vi.fn();
  setSelectionRange = vi.fn();
  closest = vi.fn(() => null);
}
let active: Control;
let field: any;
let selection: any;
let documentStub: any;
let modern: ReturnType<typeof vi.fn>;
beforeEach(() => {
  active = new Control();
  field = {
    value: "",
    style: {},
    focus: vi.fn(),
    select: vi.fn(),
    remove: vi.fn(),
  };
  const range = {};
  selection = {
    rangeCount: 1,
    getRangeAt: () => ({ cloneRange: () => range }),
    removeAllRanges: vi.fn(),
    addRange: vi.fn(),
  };
  documentStub = {
    activeElement: active,
    getSelection: () => selection,
    createElement: vi.fn(() => field),
    body: { appendChild: vi.fn() },
    execCommand: vi.fn(() => true),
  };
  modern = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("window", {});
  vi.stubGlobal("navigator", { clipboard: { writeText: modern } });
  vi.stubGlobal("document", documentStub);
  vi.stubGlobal("HTMLInputElement", Control);
  vi.stubGlobal("HTMLTextAreaElement", Control);
});
afterEach(() => vi.unstubAllGlobals());

describe("shared clipboard writer", () => {
  it("uses the native write-only bridge, not browser permissions", async () => {
    const invoke = vi.fn().mockResolvedValue(true);
    window.litebox = { invoke } as any;
    await writeClipboard("00001|90071992547409931234\n中文");
    expect(invoke).toHaveBeenCalledWith(
      "clipboard:write",
      "00001|90071992547409931234\n中文",
    );
    expect(modern).not.toHaveBeenCalled();
  });
  it("propagates native failures rather than reporting success", async () => {
    window.litebox = {
      invoke: vi.fn().mockRejectedValue(new Error("denied")),
    } as any;
    await expect(writeClipboard("x")).rejects.toThrow("denied");
    expect(modern).not.toHaveBeenCalled();
  });
  it("uses the browser API with exact text", async () => {
    await writeClipboard("00001|90071992547409931234\n中文😀");
    expect(modern).toHaveBeenCalledWith("00001|90071992547409931234\n中文😀");
    expect(documentStub.createElement).not.toHaveBeenCalled();
  });
  it("falls back after rejection and restores focus and selection", async () => {
    modern.mockRejectedValue(new Error("denied"));
    await writeClipboard("0001|0002");
    expect(field.value).toBe("0001|0002");
    expect(documentStub.execCommand).toHaveBeenCalledWith("copy");
    expect(field.remove).toHaveBeenCalledOnce();
    expect(active.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(active.setSelectionRange).toHaveBeenCalledWith(2, 5, "forward");
    expect(selection.addRange).toHaveBeenCalledOnce();
  });
  it("falls back when the clipboard API is absent", async () => {
    vi.stubGlobal("navigator", {});
    await writeClipboard("text");
    expect(documentStub.execCommand).toHaveBeenCalledWith("copy");
  });
  it("does not report success when fallback returns false", async () => {
    modern.mockRejectedValue(new Error("denied"));
    documentStub.execCommand.mockReturnValue(false);
    await expect(writeClipboard("x")).rejects.toThrow("Clipboard write failed");
    expect(field.remove).toHaveBeenCalledOnce();
    expect(active.focus).toHaveBeenCalledOnce();
  });
  it("cleans up even when fallback throws", async () => {
    modern.mockRejectedValue(new Error("denied"));
    documentStub.execCommand.mockImplementation(() => {
      throw new Error("unsupported");
    });
    await expect(writeClipboard("x")).rejects.toThrow("unsupported");
    expect(field.remove).toHaveBeenCalledOnce();
  });
  it("supports an empty string", async () => {
    await writeClipboard("");
    expect(modern).toHaveBeenCalledWith("");
  });
});
