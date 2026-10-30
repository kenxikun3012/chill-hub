import { z } from "zod";

/** Primary keys are text (UUID strings for most tables; Better Auth IDs for users). */
export const idSchema = z.string().trim().min(1).max(64);
export const idParamSchema = z.object({ id: idSchema });

/**
 * Date-time input: an ISO 8601 string such as "2026-10-28T20:00:00+06:30" or "...Z", converted to a Date.
 * (A string schema rather than z.coerce.date() so it can be described in OpenAPI.)
 */
export const dateTimeSchema = z.iso
  .datetime({ offset: true })
  .transform((s) => new Date(s));

/** Optional text field in a request body: empty strings become null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

/** Cursor pagination for list endpoints: ?limit=20&cursor=<id of the last item>. */
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: idSchema.optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Every list endpoint returns this shape. nextCursor is null on the last page. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Shape of every error response from the API. */
export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: string[];
}
