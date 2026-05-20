import { z } from "zod";

 const urlSchema = z.object({
  full_url: z.string().trim().url({
    message: "Invalid URL",
  }),
  short_url: z
    .string()
    .trim()
    .min(3, {
      message: "Slug must be at least 3 characters",
    })
    .max(50, {
      message: "Slug cannot exceed 50 characters",
    })
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "Custom Urls can only contain lowercase letters, numbers, and hyphens",
    }),
});

export default urlSchema;
