// POST /api/waitlist — early-access signups. Validates, de-duplicates by email, stores in SQLite (lib/db.ts) and sends
// a confirmation email when an email provider is configured. Stores only email, area, flying frequency, usual
// arrival time and timestamp (no IP or user agent).
import { getDb } from "@/lib/db";
import { sendConfirmation } from "@/lib/email";
import { parseSignup } from "@/lib/waitlist";
import { addSignup } from "@/lib/waitlist-store";

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 1024) return Response.json({ error: "Request too large." }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = parseSignup(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const { position, existing } = addSignup(getDb(), parsed.value);
  if (!existing) await sendConfirmation(parsed.value.email, position, parsed.value.area);
  return Response.json({ position, existing }, { status: existing ? 200 : 201 });
}
