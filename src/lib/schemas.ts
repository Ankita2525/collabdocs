import { z } from "zod";

export const loginSchema = z.object({ userId: z.uuid() });

export const titleSchema = z
  .string({ error: "Title is required" })
  .trim()
  .min(1, "Title cannot be empty")
  .max(200, "Title must be 200 characters or fewer");

export const createDocumentSchema = z.object({
  title: titleSchema.optional(),
});

export const patchDocumentSchema = z
  .object({ title: titleSchema.optional() })
  .refine((v) => v.title !== undefined, { message: "Nothing to update" });

export const DEFAULT_TITLE = "Untitled document";

/** Turns a Zod failure into one readable sentence for the API error message. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid request";
}
