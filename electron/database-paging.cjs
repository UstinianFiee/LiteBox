"use strict";
function pageOptions(input) {
  if (!input) return { offset: 0, limit: 1000, paged: false };
  const offset = input.offset ?? 0,
    limit = input.limit ?? 50;
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 1000
  )
    throw Error("Invalid pagination / 分页参数无效");
  return { offset, limit, paged: true };
}
function collector(input) {
  const { offset, limit, paged } = pageOptions(input);
  const rows = [];
  let seen = 0,
    bytes = 0,
    hasMore = false;
  function accept(row) {
    if (seen++ < offset) return true;
    const values = row.map((v) => (v == null ? null : String(v)));
    const size = Buffer.byteLength(JSON.stringify(values));
    if (
      rows.length >= limit ||
      (rows.length > 0 && bytes + size > 2 * 1024 * 1024)
    ) {
      hasMore = true;
      return false;
    }
    // Never silently drop the first oversized record or split a cell across pages.
    if (size > 32 * 1024 * 1024)
      throw Error(
        "A record exceeds 32 MiB; select fewer columns / 单条记录超过32 MiB，请选择更少的字段",
      );
    rows.push(values);
    bytes += size;
    return true;
  }
  return {
    accept,
    result: (columns) => ({
      columns,
      rows,
      truncated: !paged && hasMore,
      hasMore,
      offset,
      nextOffset: offset + rows.length,
    }),
  };
}
module.exports = { pageOptions, collector };
