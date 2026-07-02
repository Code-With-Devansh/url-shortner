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
    .regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/, {
      message: "Custom Urls can only contain letters, numbers, and hyphens",
    }),
});

export default urlSchema;
