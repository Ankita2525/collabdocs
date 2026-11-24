import { z } from "zod";

export const loginSchema = z.object({ userId: z.uuid() });
