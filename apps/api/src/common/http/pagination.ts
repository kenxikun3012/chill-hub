import type { Page, PaginationQuery } from "@chill-hub/shared";

/** Prisma findMany arguments for cursor pagination (fetch one extra row to know if there is a next page). */
export function cursorArgs(q: PaginationQuery) {
  return {
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
  };
}

export function toPage<T extends { id: string }>(rows: T[], limit: number): Page<T>;
export function toPage<R extends { id: string }, T>(rows: R[], limit: number, map: (row: R) => T): Page<T>;
export function toPage<R extends { id: string }, T>(rows: R[], limit: number, map?: (row: R) => T): Page<T | R> {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  return {
    items: map ? pageRows.map(map) : pageRows,
    nextCursor: hasMore ? pageRows[pageRows.length - 1]!.id : null,
  };
}
