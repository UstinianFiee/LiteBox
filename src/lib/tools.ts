import { parse, stringify } from "lossless-json";
import YAML from "yaml";
export interface OrderOptions {
  size: number;
  delimiter: string;
  dedupe: boolean;
  quote: string;
  split: string;
  mode: string;
}
export function tokenize(input: string, split = "auto"): string[] {
  const regex =
    split === "lines"
      ? /\r?\n/
      : split === "comma"
        ? /[,，\r\n]+/
        : split === "pipe"
          ? /[|\r\n]+/
          : /[\s,，;；|]+/;
  return input
    .split(regex)
    .map((v) => v.trim())
    .filter(Boolean);
}
export function groupOrders(input: string, options: OrderOptions) {
  const raw = tokenize(input, options.split);
  let items = options.dedupe ? [...new Set(raw)] : raw;
  const count = Math.max(
    1,
    Math.min(100000, Math.floor(Number(options.size) || 1)),
  );
  const groups: string[][] = [];
  if (options.mode === "groups") {
    const n = Math.min(count, items.length);
    let start = 0;
    for (let i = 0; i < n; i++) {
      const size =
        Math.floor(items.length / n) + (i < items.length % n ? 1 : 0);
      groups.push(items.slice(start, start + size));
      start += size;
    }
  } else
    for (let i = 0; i < items.length; i += count)
      groups.push(items.slice(i, i + count));
  const delimiter = options.delimiter === "\\n" ? "\n" : options.delimiter;
  return {
    rawCount: raw.length,
    count: items.length,
    duplicates: raw.length - new Set(raw).size,
    groups: groups.map((values) => ({
      count: values.length,
      text: values
        .map((v) => options.quote + v + options.quote)
        .join(delimiter),
    })),
  };
}
export function compareSets(a: string, b: string, mode: string) {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  return [...left]
    .filter((v) => (mode === "intersection" ? right.has(v) : !right.has(v)))
    .join("\n");
}
export const conversionIds = [
  "json-pretty",
  "json-minify",
  "json-yaml",
  "yaml-json",
  "base64-encode",
  "base64-decode",
  "url-encode",
  "url-decode",
  "timestamp",
  "dedupe",
  "uuid",
] as const;
export function convert(input: string, operation: string): string {
  switch (operation) {
    case "json-pretty":
      return stringify(parse(input), null, 2) ?? "";
    case "json-minify":
      return stringify(parse(input)) ?? "";
    case "json-yaml": {
      const normalized = stringify(
        parse(input, undefined, (value) => {
          const n = Number(value);
          if (
            !Number.isFinite(n) ||
            (Number.isInteger(n) && !Number.isSafeInteger(n))
          )
            throw new Error(
              "Unsafe large integer: use JSON formatting to preserve precision.",
            );
          return n;
        }),
      );
      return YAML.stringify(JSON.parse(normalized || "null"));
    }
    case "yaml-json":
      return JSON.stringify(
        YAML.parse(input, { maxAliasCount: 50, intAsBigInt: true }),
        (_, value) => {
          if (typeof value !== "bigint") return value;
          return value <= BigInt(Number.MAX_SAFE_INTEGER) &&
            value >= BigInt(Number.MIN_SAFE_INTEGER)
            ? Number(value)
            : value.toString();
        },
        2,
      );
    case "base64-encode":
      return btoa(
        Array.from(new TextEncoder().encode(input), (byte) =>
          String.fromCharCode(byte),
        ).join(""),
      );
    case "base64-decode":
      return new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(atob(input.replace(/\s/g, "")), (c) => c.charCodeAt(0)),
      );
    case "url-encode":
      return encodeURIComponent(input);
    case "url-decode":
      return decodeURIComponent(input);
    case "dedupe":
      return [
        ...new Set(
          input
            .split(/\r?\n/)
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      ].join("\n");
    case "uuid":
      return Array.from(
        { length: Math.max(1, Math.min(100, parseInt(input) || 1)) },
        () => crypto.randomUUID(),
      ).join("\n");
    case "timestamp": {
      const raw = input.trim();
      const numeric = /^-?\d+$/.test(raw);
      const date = numeric
        ? new Date(Number(raw) * (raw.replace("-", "").length <= 10 ? 1000 : 1))
        : new Date(raw);
      if (!Number.isFinite(date.getTime()))
        throw new Error("Invalid date / 无效时间");
      return `UTC:   ${date.toISOString()}\nLocal: ${date.toLocaleString()}\nZone:  ${Intl.DateTimeFormat().resolvedOptions().timeZone}\nSeconds:      ${Math.floor(date.getTime() / 1000)}\nMilliseconds: ${date.getTime()}`;
    }
    default:
      throw new Error("Unknown conversion");
  }
}
