// Early-access waitlist: input validation shared by the API route and its test. Pure, no I/O.
export const AREAS = ["Cyber City", "Golf Course Road", "Sohna Road", "Other Gurugram"] as const;
export type Area = (typeof AREAS)[number];
export const FREQUENCY = ["Weekly or more", "Monthly", "A few times a year", "Rarely"] as const;
export const ARRIVAL = ["Morning", "Afternoon", "Evening", "Late night"] as const;
export interface Signup { email: string; area: Area; frequency: (typeof FREQUENCY)[number]; arrival: (typeof ARRIVAL)[number] }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function parseSignup(body: unknown): { ok: true; value: Signup } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid request." };
  const { email, area, frequency, arrival } = body as Record<string, unknown>;
  if (typeof email !== "string" || email.length > 254 || !EMAIL.test(email.trim())) return { ok: false, error: "Enter a valid email address." };
  if (typeof area !== "string" || !(AREAS as readonly string[]).includes(area)) return { ok: false, error: "Pick where you're heading." };
  if (typeof frequency !== "string" || !(FREQUENCY as readonly string[]).includes(frequency)) return { ok: false, error: "Tell us how often you fly in." };
  if (typeof arrival !== "string" || !(ARRIVAL as readonly string[]).includes(arrival)) return { ok: false, error: "Pick when you usually land." };
  return { ok: true, value: { email: email.trim().toLowerCase(), area: area as Area, frequency: frequency as Signup["frequency"], arrival: arrival as Signup["arrival"] } };
}
