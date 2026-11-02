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
  album: z.string().max(500).optional(),
  isrc: z.string().max(30).optional(),
  explicit: z.boolean().nullable(),
  selected: z.boolean().default(true),
});
export const platformId = z.enum([
  "spotify",
  "youtube",
  "apple",
  "deezer",
  "tidal",
  "soundcloud",
]);
export const wizardSchema = z.object({
  version: z.literal(2).default(2),
  step: z.number().int().min(0).max(3).default(0),
  source: z.union([platformId, z.literal("")]),
  destination: z.union([platformId, z.literal("")]),
  inputMode: z.enum(["account", "url"]).default("account"),
  playlistUrl: z.string().max(2000).default(""),
  transferId: z.string().max(100).optional(),
  playlistId: z.string().max(300).optional(),
  playlistName: z.string().min(1).max(200),
  sourcePlaylistName: z.string().min(1).max(200).optional(),
  includeExplicit: z.boolean().default(true),
  cleanMode: z.enum(["skip", "replace"]).default("skip"),
  tracks: z.array(trackSchema).max(1000),
});
export type WizardState = z.infer<typeof wizardSchema>;
