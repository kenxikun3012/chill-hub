import { z } from "zod";
import { dateTimeSchema, paginationQuerySchema } from "./common.js";
import { inGameAccountCreateSchema } from "./profiles.js";
import { approvalStatusSchema, roleNameSchema, userStatusSchema } from "./enums.js";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const studentIdNumberSchema = z.string().trim().min(3).max(32);
/** Same limits as Better Auth in the API. */
export const passwordSchema = z.string().min(8, "At least 8 characters").max(128, "At most 128 characters");

/** Admin-created account (also used by tests and dev tooling). Normal sign-up arrives in step 3a. */
export const userCreateSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  studentIdNumber: studentIdNumberSchema,
  status: userStatusSchema.optional(),
  roles: z.array(roleNameSchema).max(4).optional(),
});

export const userUpdateSchema = z.strictObject({
  name: z.string().trim().min(1).max(100).optional(),
  status: userStatusSchema.optional(),
  suspendedUntil: dateTimeSchema.nullable().optional(),
});

export const userRolesSchema = z.strictObject({
  roles: z
    .array(roleNameSchema)
    .max(4)
    .refine((r) => new Set(r).size === r.length, "Roles must be unique"),
});

export const usersListQuerySchema = paginationQuerySchema.extend({
  status: userStatusSchema.optional(),
  role: roleNameSchema.optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

/** Sign-up step 3 (ACC-01); also used to fix details after a rejection. */
export const signUpDetailsSchema = z.strictObject({
  studentIdNumber: studentIdNumberSchema,
  inGameAccount: inGameAccountCreateSchema,
});

/** Admin decision on a sign-up (ACC-04): a reason is required to reject. */
export const approvalDecisionSchema = z.discriminatedUnion("decision", [
  z.strictObject({ decision: z.literal("approve") }),
  z.strictObject({ decision: z.literal("reject"), rejectReason: z.string().trim().min(3).max(500) }),
]);

export const approvalsListQuerySchema = paginationQuerySchema.extend({
  status: approvalStatusSchema.default("pending"),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type UserRolesInput = z.infer<typeof userRolesSchema>;
export type UsersListQuery = z.infer<typeof usersListQuerySchema>;
export type SignUpDetailsInput = z.infer<typeof signUpDetailsSchema>;
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;
export type ApprovalsListQuery = z.infer<typeof approvalsListQuerySchema>;
