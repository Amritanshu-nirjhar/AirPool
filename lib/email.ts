// Waitlist confirmation email via Resend's HTTP API (no SDK). Sends only when RESEND_API_KEY and EMAIL_FROM are set;
// otherwise it's a logged no-op so local development works without an account.
export async function sendConfirmation(to: string, position: number, area: string): Promise<"sent" | "skipped" | "failed"> {
  const key = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM;
  if (!key || !from) return "skipped";
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;color:#10231f">
    <p style="font-size:13px;letter-spacing:.2em;color:#8a6128">AIRPOOL · EARLY ACCESS</p>
    <h1 style="font-size:28px;margin:8px 0">You're #${position} for DEL T3 → ${escape(area)}.</h1>
    <p>We'll email you when shared rides from Delhi Airport T3 open on your corridor. Nothing else.</p>
    ${site ? `<p><a href="${site}" style="color:#0f3d34">Share AirPool with someone flying in →</a></p>` : ""}
    <p style="font-size:12px;color:#58625e">You signed up at ${escape(site || "AirPool")}. Reply to this email to be removed.</p></div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: `You're #${position} on the AirPool list`, html }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
