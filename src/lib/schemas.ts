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

/**
 * PATCH is either a rename ({title}) or a content save ({content, baseVersion}), never both:
 * the two need different permissions. `content` is validated separately against the editor schema.
 */
export const patchDocumentSchema = z
  .object({
    title: titleSchema.optional(),
    content: z.unknown().optional(),
    baseVersion: z.number().int().positive().optional(),
  })
  .superRefine((v, ctx) => {
    const hasTitle = v.title !== undefined;
    const hasContent = v.content !== undefined;
    if (hasTitle === hasContent) {
      ctx.addIssue({ code: "custom", message: "Send either a title or content to update" });
    } else if (hasContent && v.baseVersion === undefined) {
      ctx.addIssue({ code: "custom", message: "baseVersion is required when saving content" });
    }
  });

export const shareSchema = z.object({
  userId: z.uuid({ error: "Choose a user to share with" }),
  role: z.enum(["viewer", "editor"], { error: "Role must be viewer or editor" }),
});

export const DEFAULT_TITLE = "Untitled document";

/** Turns a Zod failure into one readable sentence for the API error message. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid request";
}
