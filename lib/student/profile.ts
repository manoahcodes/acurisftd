import { RELATIONSHIPS, type ContactDetails, type Relationship } from "@/types/student";

/** Checks for the details a student may change about themselves. Pure, so the server action and the form agree. */

export const PROFILE_LIMITS = { email: 120, address: 200, name: 80, phone: { min: 7, max: 20 } };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;

export type ContactErrors = Partial<Record<keyof ContactDetails, string>>;
export type ContactCheck = { ok: true; value: ContactDetails } | { ok: false; errors: ContactErrors };

const clean = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/** Phone, email and address are optional. An emergency contact is required: a name, how they are related, and a phone number. */
export function checkContact(raw: Record<string, unknown>): ContactCheck {
  const errors: ContactErrors = {};
  const phone = clean(raw.phone);
  if (phone && !PHONE.test(phone)) errors.phone = "Enter a valid phone number, such as +260 971 234 567.";

  const email = clean(raw.email).toLowerCase();
  if (email && (email.length > PROFILE_LIMITS.email || !EMAIL.test(email))) errors.email = "Enter a valid email address.";

  const address = clean(raw.address);
  if (address.length > PROFILE_LIMITS.address) errors.address = `At most ${PROFILE_LIMITS.address} characters.`;

  const emergencyName = clean(raw.emergencyName);
  if (emergencyName.length < 2) errors.emergencyName = "Enter the name of someone we can call.";
  else if (emergencyName.length > PROFILE_LIMITS.name) errors.emergencyName = `At most ${PROFILE_LIMITS.name} characters.`;

  const relationship = RELATIONSHIPS.find((r) => r === raw.emergencyRelationship) as Relationship | undefined;
  if (!relationship) errors.emergencyRelationship = "Choose how this person is related to you.";

  const emergencyPhone = clean(raw.emergencyPhone);
  if (!emergencyPhone) errors.emergencyPhone = "Enter a phone number we can reach them on.";
  else if (!PHONE.test(emergencyPhone)) errors.emergencyPhone = "Enter a valid phone number, such as +260 977 123 456.";
  else if (phone && emergencyPhone.replace(/\D/g, "") === phone.replace(/\D/g, "")) errors.emergencyPhone = "This is your own number. Give a number for someone else.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { phone, email, address, emergencyName, emergencyRelationship: relationship!, emergencyPhone } };
}

/** Photos: PNG or JPEG only, so nothing that can carry a script, and small. */
export const MAX_PHOTO_BYTES = 1024 * 1024;

export function sniffPhoto(bytes: Uint8Array): "image/png" | "image/jpeg" | undefined {
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return undefined;
}

export type ReadPhoto = { ok: true; photo: { type: "image/png" | "image/jpeg"; size: number; data: string } } | { ok: false; error: string };

export async function readPhoto(file: unknown): Promise<ReadPhoto> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a photo to upload." };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, error: "The photo must be 1 MB or smaller." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffPhoto(bytes);
  if (!type) return { ok: false, error: "Use a PNG or JPEG photo." };
  return { ok: true, photo: { type, size: bytes.length, data: Buffer.from(bytes).toString("base64") } };
}

/** Initials for the picture shown when there is no photo. */
export const initialsOf = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
