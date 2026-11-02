import { z } from "zod";
export const password = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128)
  .refine(
    (s) => new TextEncoder().encode(s).length <= 72,
    "Password must be at most 72 UTF-8 bytes for bcrypt",
  );
export const email = z
  .email()
  .max(254)
  .transform((s) => s.toLowerCase().trim());
export const names = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
});
export const registerSchema = names
  .extend({ email, password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});
export const trackSchema = z.object({
  id: z.string().max(300),
  title: z.string().min(1).max(500),
  artist: z.string().min(1).max(500),
  duration: z.number().int().min(0).max(86400000),
  isrc: z.string().max(30).optional(),
  explicit: z.boolean().nullable(),
  selected: z.boolean().default(true),
});
export const wizardSchema = z.object({
  step: z.number().int().min(0).max(6).default(0),
  source: z.string().max(30),
  sourceTransport: z.enum(["direct", "csv"]).default("direct"),
  destinationTransport: z.enum(["direct", "csv"]).default("direct"),
  destination: z.string().max(30),
  playlistId: z.string().max(300).optional(),
  playlistName: z.string().min(1).max(200),
  sourcePlaylistName: z.string().min(1).max(200).optional(),
  includeExplicit: z.boolean(),
  cleanMode: z.enum(["skip", "replace"]),
  tracks: z.array(trackSchema).max(1000),
});
