// GET /admin — waitlist demand view (HTTP Basic auth: any username, password = ADMIN_PASSWORD).
// GET /admin?format=csv downloads every signup. Disabled entirely when ADMIN_PASSWORD is not set.
import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { allRows, summary } from "@/lib/waitlist-store";

const deny = () => new Response("Authentication required.", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="AirPool admin", charset="UTF-8"' } });

function authorised(request: Request, password: string) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  const given = Buffer.from(Buffer.from(header.slice(6), "base64").toString("utf8").split(":").slice(1).join(":"));
  const want = Buffer.from(password);
  return given.length === want.length && timingSafeEqual(given, want);
}

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const csvCell = (v: unknown) => { const s = String(v); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; };

export async function GET(request: Request) {
  await connection(); // always per-request: never prerender or cache the admin view
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return new Response("Admin is disabled. Set ADMIN_PASSWORD to enable it.", { status: 404 });
  if (!authorised(request, password)) return deny();
  const db = getDb();
  const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

  if (new URL(request.url).searchParams.get("format") === "csv") {
    const rows = allRows(db);
    const cols = ["id", "email", "area", "frequency", "arrival", "at"];
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n");
    return new Response(csv, { headers: { ...noStore, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="airpool-waitlist.csv"' } });
  }

  const s = summary(db);
  const bars = (title: string, rows: { k: string; n: number }[]) => `
    <section><h2>${esc(title)}</h2>${rows.length ? rows.map((r) => `
      <div class="row"><span>${esc(r.k)}</span><span class="bar"><i style="width:${s.total ? (r.n / s.total) * 100 : 0}%"></i></span><b>${r.n}</b></div>`).join("") : `<p class="muted">No signups yet.</p>`}</section>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>AirPool · Waitlist</title><style>
:root{--ink:#f7f7f4;--text:#10231f;--muted:#58625e;--line:#d9dbd3;--em:#0f3d34;--brass:#a6763a}
@media (prefers-color-scheme:dark){:root{--ink:#0e1714;--text:#eef0ea;--muted:#9aa6a1;--line:#24332e;--em:#8fd1bb;--brass:#e0b06a}}
*{box-sizing:border-box}body{margin:0;background:var(--ink);color:var(--text);font:15px/1.5 system-ui,sans-serif;padding:32px 16px}
main{max-width:960px;margin:auto}h1{margin:0 0 4px;font-size:28px}h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 12px}
.muted{color:var(--muted)}.grid{display:grid;gap:28px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin:28px 0}
.total{font-size:56px;font-weight:700;color:var(--em);line-height:1}.row{display:grid;grid-template-columns:9rem 1fr 2.5rem;gap:10px;align-items:center;margin:6px 0}
.bar{height:8px;background:var(--line);border-radius:4px;overflow:hidden}.bar i{display:block;height:100%;background:var(--brass)}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line)}th{color:var(--muted);font-weight:600}
a.btn{display:inline-block;padding:8px 14px;border:1px solid var(--line);border-radius:8px;color:var(--text);text-decoration:none}
.scroll{overflow-x:auto}</style></head><body><main>
<p class="muted">AirPool · DEL T3 → Gurugram</p><h1>Waitlist demand</h1>
<div class="grid"><section><h2>Total signups</h2><div class="total">${s.total}</div><p><a class="btn" href="/admin?format=csv">Download CSV</a></p></section>
${bars("Heading to", s.byArea)}${bars("Usually lands", s.byArrival)}${bars("Flies into Delhi", s.byFrequency)}</div>
<section><h2>Latest ${s.recent.length}</h2><div class="scroll"><table><thead><tr><th>Email</th><th>Area</th><th>Lands</th><th>Frequency</th><th>Signed up</th></tr></thead><tbody>
${s.recent.map((r) => `<tr><td>${esc(r.email)}</td><td>${esc(r.area)}</td><td>${esc(r.arrival)}</td><td>${esc(r.frequency)}</td><td>${esc(new Date(r.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }))}</td></tr>`).join("")}
</tbody></table></div></section></main></body></html>`;
  return new Response(html, { headers: { ...noStore, "Content-Type": "text/html; charset=utf-8" } });
}
