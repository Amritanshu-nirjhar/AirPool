"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { OPEN_GROUPS } from "@/lib/demo-data";
import HelpDialog from "./HelpDialog";
import { Waitlist } from "./Extras";
import { Logo } from "./Nav";
import { SimBadge } from "./ui";

const fade = { initial: { opacity: 0, y: 28 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-12%" }, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } } as const;

/* ---------------- Safety ---------------- */
const TRUST = [
  ["First names only", "Co-travellers see your first name and drop-off area. Never your phone number."],
  ["Verified status", "A verified indicator on every co-traveller before you join."],
  ["Explicit opt-in", "You choose to share. Matching never books you automatically."],
  ["Consent before status sharing", "Trip status is shared only after you agree to it."],
  ["Trusted-contact sharing", "Send your live trip to someone you trust, if you want to."],
  ["Visible Help button", "Help is one tap away on every screen of a trip."],
  ["Incident reporting", "Report a concern during or after the ride."],
  ["Cancellation terms up front", "Shown before you confirm, not after."],
];

/** One pre-flight checklist row: the tick draws itself when the row scrolls into view. */
function CheckRow({ t, d, i, onCheck }: { t: string; d: string; i: number; onCheck: () => void }) {
  return (
    <motion.li
      initial="off"
      whileInView="on"
      viewport={{ once: true, margin: "-18% 0px" }}
      onViewportEnter={onCheck}
      className="flex gap-4 border-t border-text/10 py-5"
    >
      <span className="relative mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-text/20">
        <motion.span className="absolute inset-0 rounded-full bg-good" variants={{ off: { scale: 0 }, on: { scale: 1 } }} transition={{ delay: 0.15 + (i % 2) * 0.12, type: "spring", stiffness: 300, damping: 20 }} />
        <svg viewBox="0 0 24 24" className="relative h-3.5 w-3.5" aria-hidden>
          <motion.path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#f7f7f4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" variants={{ off: { pathLength: 0 }, on: { pathLength: 1 } }} transition={{ delay: 0.3 + (i % 2) * 0.12, duration: 0.35 }} />
        </svg>
      </span>
      <div>
        <p className="font-medium">{t}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{d}</p>
      </div>
    </motion.li>
  );
}

export function Safety() {
  const [help, setHelp] = useState(false);
  const [checked, setChecked] = useState(0);
  const [optIn, setOptIn] = useState(false);
  const [statusShare, setStatusShare] = useState(false);
  return (
    <section id="safety" className="relative border-t border-text/5" aria-labelledby="safety-title">
      <div className="mx-auto max-w-7xl px-5 py-28 md:px-10 md:py-40">
        <div className="grid gap-16 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="label">Safety & trust</p>
            <h2 id="safety-title" className="display display-xl mt-5 text-[clamp(2.3rem,5vw,4.4rem)]">Shared rides. Clear choices.</h2>
            <div className="mt-12 flex items-center justify-between text-sm">
              <span className="font-medium">Pre-flight checklist</span>
              <span className="mono text-muted" aria-live="polite">{Math.min(checked, TRUST.length)} / {TRUST.length} checked</span>
            </div>
            <ul className="mt-3 grid gap-x-10 sm:grid-cols-2">
              {TRUST.map(([t, d], i) => <CheckRow key={t} t={t} d={d} i={i} onCheck={() => setChecked((c) => c + 1)} />)}
            </ul>
          </div>

          {/* Live trust controls: same components as the booking flow */}
          <motion.div {...fade} className="lg:col-span-5 lg:col-start-8 lg:pt-32">
            <div className="rounded-2xl border border-text/10 bg-ink-2 p-6">
              <div className="flex items-center justify-between">
                <p className="label">Your co-travellers</p>
                <SimBadge />
              </div>
              <ul className="mt-4 divide-y divide-text/5">
                {OPEN_GROUPS[0].members.map((m) => (
                  <li key={m.name} className="flex items-center justify-between py-3.5">
                    <span className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-text/5">{m.name[0]}</span>
                      <span>
                        {m.name}
                        {/* the number is struck out by a redaction bar as the card scrolls in: co-travellers never see it */}
                        <span className="relative mt-0.5 block w-fit font-mono text-[11px] text-muted">
                          +91 98··· ·····
                          <motion.span className="absolute inset-y-0 -inset-x-0.5 origin-left rounded-sm bg-night" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, margin: "-20% 0px" }} transition={{ delay: 0.6, duration: 0.5, ease: [0.65, 0, 0.35, 1] }} aria-hidden />
                        </span>
                      </span>
                    </span>
                    <span className="text-right text-xs"><span className="text-good">✓ Verified</span><span className="block text-muted">number hidden</span></span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 space-y-4 border-t border-text/10 pt-5 text-sm">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5 shrink-0" />
                  <span>I opt in to shared matching for this trip</span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={statusShare} onChange={(e) => setStatusShare(e.target.checked)} className="mt-0.5 shrink-0" />
                  <span>Share my trip status with a trusted contact</span>
                </label>
                <p className="text-xs text-muted" role="status">
                  {optIn ? "Opted in." : "Not opted in."} {statusShare ? "Status sharing on." : "Status sharing off."} Nothing is pre-selected.
                </p>
              </div>
              <button onClick={() => setHelp(true)} className="btn relative mt-6 w-full border border-bad/40 bg-bad/10 text-bad hover:bg-bad/15">
                <span className="help-pulse pointer-events-none absolute inset-0 rounded-[8px] border border-bad/40" aria-hidden />
                Help & report an incident
              </button>
            </div>
          </motion.div>
        </div>
      </div>
      <HelpDialog open={help} onClose={() => setHelp(false)} />
    </section>
  );
}

/* ---------------- FAQ ---------------- */
const FAQ: [string, string][] = [
  ["What if my flight is delayed?", "Your request follows your arrival window. If you land outside it, you're re-matched with groups leaving later, or released with no charge if none fit. Automatic flight-status sync comes after the MVP."],
  ["How much luggage can I bring?", "Tell us your bags when you request. AirPool only groups you into a car whose boot fits everyone's luggage."],
  ["Can I cancel?", "Yes. Cancel free until your group is confirmed. Cancellation terms are shown before you join, never after."],
  ["Is it safe to ride with strangers?", "Co-travellers see your first name and drop-off area only, never your phone number. Everyone opts in explicitly, Help is on every screen, and you can share your trip with someone you trust."],
  ["How do I pay?", "In the MVP you pay your share, shown upfront, at drop-off. In-app payment and automatic splitting come next."],
  ["Where does it work?", "At launch, Delhi Airport T3 arrivals to Gurugram: Cyber City, Golf Course Road and Sohna Road. More corridors follow."],
];

const faqId = (q: string) => "faq-" + q.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);

export function Faq() {
  // deep links: /#faq-what-if-my-flight-is-delayed opens that answer
  useEffect(() => {
    const el = window.location.hash.startsWith("#faq-") ? document.querySelector<HTMLDetailsElement>(window.location.hash) : null;
    if (el) el.open = true;
  }, []);
  return (
    <section id="faq" className="relative border-t border-text/5" aria-labelledby="faq-title">
      <div className="mx-auto max-w-3xl px-5 py-28 md:px-10 md:py-40">
        <div className="text-center">
          <p className="label">Questions</p>
          <h2 id="faq-title" className="display display-xl mt-5 text-[clamp(2.3rem,4.6vw,4rem)]">Before you <span className="serif-word text-glow">land</span>.</h2>
        </div>
        <div className="mt-14">
          {FAQ.map(([q, a]) => (
            <details key={q} id={faqId(q)} className="group scroll-mt-28 border-t border-text/10 py-5 last:border-b">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 font-display text-xl marker:hidden [&::-webkit-details-marker]:hidden">
                {q}
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-text/15 text-lg transition-transform duration-300 group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-3 max-w-xl leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Closing ---------------- */
export function Closing() {
  return (
    <>
      <section className="mood-night relative overflow-hidden" aria-labelledby="cta-title">
        <div className="pointer-events-none absolute left-1/2 top-24 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(201,160,99,0.14),transparent_60%)]" aria-hidden />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-5 pb-28 pt-32 text-center md:px-10 md:pb-40 md:pt-44">
          {/* the mark draws itself: two paths converge into one rising arrow */}
          <svg width="72" height="90" viewBox="0 0 40 50" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <motion.path d="M5 46 C5 36 19 33 20 24 M35 46 C35 36 21 33 20 24" stroke="#c9a063" strokeWidth="2.6" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, margin: "-20%" }} transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }} />
            <motion.path d="M20 46 V5 M12 13 L20 5 L28 13" stroke="#f1ede3" strokeWidth="2.6" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, margin: "-20%" }} transition={{ duration: 0.9, delay: 0.7, ease: [0.65, 0, 0.35, 1] }} />
          </svg>
          <h2 id="cta-title" className="display mt-10 text-[clamp(3rem,9vw,8.5rem)]">
            Many travellers.<br /><span className="serif-word foil">One ride.</span>
          </h2>
          <p className="mt-8 max-w-md text-lg text-muted">Launching first at Delhi Airport T3 → Gurugram. Join early access and board first.</p>
          <div className="w-full max-w-lg text-left">
            <Waitlist />
          </div>
          <a href="#book" className="mt-3 inline-block min-h-11 text-sm text-muted underline-offset-4 hover:text-text hover:underline">Or try the booking demo ↑</a>
        </div>
      </section>
      <footer className="mood-night border-t border-text/10">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 text-sm text-muted md:grid-cols-12 md:px-10">
          <div className="md:col-span-4">
            <Logo tagline light />
            <p className="mt-4 max-w-xs">Shared airport mobility. Demo corridor: Delhi Airport (DEL) T3 → Cyber City, Gurugram.</p>
          </div>
          <div className="md:col-span-5">
            <p className="text-text">About this demo</p>
            <p className="mt-3 leading-relaxed">
              Map tiles © OpenStreetMap contributors via OpenFreeMap. Road geometry from OSRM. Riders, groups, drivers, statuses and fares are simulated. No payments, dispatch or flight tracking.
            </p>
          </div>
          <nav className="md:col-span-3" aria-label="Footer">
            <ul className="space-y-2">
              {[["How it works", "#map"], ["Launch scope", "#mvp"], ["Safety", "#safety"], ["Try the demo", "#book"], ["Matching", "#engine"], ["FAQ", "#faq"], ["Privacy", "/privacy"]].map(([l, h]) => (
                <li key={h}><a href={h} className="hover:text-text">{l}</a></li>
              ))}
            </ul>
          </nav>
        </div>
      </footer>
    </>
  );
}

