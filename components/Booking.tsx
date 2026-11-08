"use client";
// Booking prototype: live map + "arrivals terminal" panel. Matching and fares come from lib/matching only.
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_WEIGHTS, OPEN_GROUPS, TERMS_VERSION } from "@/lib/demo-data";
import { PLACES, fmtTime, inr } from "@/lib/geo";
import { useT } from "./i18n";
import { track } from "@/lib/track";
import { closestFix, rankGroups } from "@/lib/matching";
import type { Consent, Group, TripRequest } from "@/lib/types";
import HelpDialog from "./HelpDialog";
import { LazyMount } from "./MapStory";
import { Flap, Magnetic, SimBadge, useReduced } from "./ui";

const CorridorMap = dynamic(() => import("./CorridorMap"), { ssr: false });

type Screen = "request" | "matches" | "details" | "confirm" | "status";
const FLIGHT_RE = /^[A-Z0-9]{2}\s?\d{1,4}[A-Z]?$/i;
const STEP_OF: Record<Screen, number> = { request: 0, matches: 1, details: 2, confirm: 3, status: 3 };
const T_MIN = 17 * 60, T_MAX = 20 * 60;
/** Light haptic tick on phones that support it (no-op elsewhere). */
const buzz = (ms: number) => { if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms); };
// Map preview for the request screen: the direct T3 → Cyber City route, no co-travellers
const SOLO_PREVIEW: Group = { ...OPEN_GROUPS[0], id: "solo", members: [], routeKey: "solo", dropOrder: ["cyberCity"] };

interface Form { start: number; end: number; flight: string; bags: number; maxWait: number; maxDetour: number }
const INITIAL: Form = { start: 18 * 60 + 15, end: 18 * 60 + 35, flight: "", bags: 1, maxWait: 15, maxDetour: 10 };

export default function Booking() {
  const reduced = useReduced();
  const t = useT();
  const [screen, setScreen] = useState<Screen>("request");
  const [form, setForm] = useState<Form>(INITIAL);
  const [flightErr, setFlightErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [shareTrip, setShareTrip] = useState(false);
  const [contact, setContact] = useState("");
  const [record, setRecord] = useState<Consent | null>(null);
  const [notify, setNotify] = useState(false);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState("");
  const [mStep, setMStep] = useState(0); // mobile: one question per screen
  const request: TripRequest = useMemo(
    () => ({ id: "you", user: "You", airport: "DEL", terminal: "T3", destination: "cyberCity", windowStart: form.start, windowEnd: form.end, bags: form.bags, maxWait: form.maxWait, maxDetour: form.maxDetour, flight: form.flight || undefined, optIn: true }),
    [form],
  );
  const result = useMemo(() => rankGroups(request, OPEN_GROUPS, DEFAULT_WEIGHTS), [request]);
  const match = result.ranked.find((m) => m.groupId === groupId);
  const group = OPEN_GROUPS.find((g) => g.id === groupId);

  // Which group the map shows
  const mapGroup =
    screen === "matches" ? OPEN_GROUPS.find((g) => g.id === (hover ?? result.ranked[0]?.groupId)) ?? SOLO_PREVIEW
    : (screen === "details" || screen === "confirm" || screen === "status") && group ? group
    : SOLO_PREVIEW;
  const vehicle = screen === "status" ? 0.01 : 0;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const find = () => {
    if (form.flight && !FLIGHT_RE.test(form.flight.trim())) return setFlightErr("Use a format like 6E 2134 or AI 101.");
    setFlightErr("");
    setLoading(true);
    setNotify(false);
    setHover(null);
    setTimeout(() => { setLoading(false); setScreen("matches"); }, 1100);
  };
  const fix = useMemo(() => (result.ranked.length ? null : closestFix(request, OPEN_GROUPS)), [result, request]);
  const confirm = () => {
    if (!consent || !group) return;
    buzz(25);
    track("Demo booking confirmed", { group: group.id });
    setRecord({ user: "You", groupId: group.id, acceptedAt: new Date().toISOString(), termsVersion: TERMS_VERSION });
    setScreen("status");
  };
  const share = async () => {
    if (!shareTrip) return setToast("Turn on trusted-contact sharing on your ride pass first.");
    const text = `AirPool demo trip: DEL T3 → Cyber City with Group ${group?.id}. Pickup ${group?.pickupPoint} (demo).`;
    try {
      if (navigator.share) await navigator.share({ title: "AirPool trip (demo)", text });
      else { await navigator.clipboard.writeText(text); setToast(`Trip summary copied for ${contact || "your contact"} (demo).`); }
    } catch { /* share sheet dismissed */ }
  };
  const reset = () => { setMStep(0); setScreen("request"); setGroupId(null); setConsent(false); setShareTrip(false); setContact(""); setRecord(null); };

  return (
    <section id="book" className="mood-night relative overflow-hidden" aria-labelledby="book-title">
      <div className="pointer-events-none absolute left-1/2 top-10 h-[40rem] w-[52rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(201,160,99,0.13),transparent)]" aria-hidden />
      <div className="relative mx-auto max-w-3xl px-5 pb-14 pt-28 text-center md:px-10 md:pb-20 md:pt-40">
        <p className="label">Try it</p>
        <h2 id="book-title" className="display display-xl mx-auto mt-5 max-w-[14ch] text-[clamp(2.4rem,5vw,4.4rem)]">{t("bookTitle")}</h2>
        <p className="mx-auto mt-6 max-w-md text-muted">{t("bookIntro")}</p>
      </div>

      {/* The console: live map + a paper kiosk, framed like one device */}
      <div className="relative mx-auto max-w-7xl px-3 pb-28 md:px-10 md:pb-40">
      <div className="grid overflow-hidden rounded-[28px] shadow-[0_60px_120px_-50px_rgba(0,0,0,0.85)] ring-1 ring-white/10 lg:grid-cols-12">
        {/* Live map */}
        <div className="relative order-2 min-h-[32svh] lg:order-none lg:col-span-7 lg:min-h-[46rem]">
          <LazyMount className="absolute inset-0">
            <CorridorMap group={mapGroup} compact progress={vehicle} className="h-full w-full" />
          </LazyMount>
          <div className="pointer-events-none absolute bottom-14 left-3 right-3 hidden flex-wrap items-center gap-2 md:left-5 md:flex">
            <span className="mono rounded-md bg-ink/80 px-2.5 py-1.5 text-[11px] text-text backdrop-blur">
              {mapGroup.id === "solo" ? "DIRECT ROUTE · T3 → CYBER CITY" : `GRP ${mapGroup.id} · ${mapGroup.dropOrder.map((d) => PLACES[d].short.toUpperCase()).join(" → ")}`}
            </span>
          </div>
        </div>

        {/* Terminal panel (first on phones: the form matters more than the map) */}
        <div className="mood-paper paper relative order-1 lg:order-none lg:col-span-5">
          <div>
            {/* header strip */}
            <div className="mono flex items-center justify-between border-b border-text/10 px-5 py-3 text-[11px] text-muted md:px-8">
              <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-flare" />AIRPOOL · ARRIVALS T3</span>
              <span className="flex items-center gap-3">
                <span className="hidden sm:inline">STEP {STEP_OF[screen] + 1}/4</span>
                <button onClick={() => setHelp(true)} className="rounded border border-text/15 px-2.5 py-1 text-text hover:bg-text/5">HELP</button>
              </span>
            </div>
            <div className="flex h-0.5 bg-text/5" aria-hidden>
              {[0, 1, 2, 3].map((i) => <div key={i} className={`flex-1 transition-colors duration-500 ${STEP_OF[screen] >= i ? "bg-flare" : ""}`} />)}
            </div>

            <div className="relative px-5 py-8 md:px-8">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={screen} initial={{ opacity: 0, y: 14, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(4px)" }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
                  {/* ---------- 1. REQUEST ---------- */}
                  {screen === "request" && (
                    <form onSubmit={(e) => { e.preventDefault(); find(); }} noValidate>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="label">FROM</p>
                          <p className="mt-1 font-sans text-6xl font-bold tracking-[-0.04em]">DEL</p>
                          <p className="mono mt-1 text-xs text-muted">T3 · ARRIVALS</p>
                        </div>
                        <svg viewBox="0 0 120 20" className="mb-8 w-24 text-flare" aria-hidden><path d="M2 10h110" stroke="currentColor" strokeDasharray="3 4" /><path d="M108 4l8 6-8 6" fill="none" stroke="currentColor" /></svg>
                        <div className="text-right">
                          <p className="label">TO</p>
                          <p className="mt-1 font-sans text-6xl font-bold tracking-[-0.04em]">CYB</p>
                          <p className="mono mt-1 text-xs text-muted">CYBER CITY · GGN</p>
                        </div>
                      </div>

                      <p className="mono mt-6 text-[11px] text-muted md:hidden">{t("question")} {mStep + 1} {t("of")} 4</p>
                      <div className={mStep === 0 ? "" : "max-md:hidden"}>
                      <Block label={t("kerbWindow")} value={`${fmtTime(form.start)} – ${fmtTime(form.end)}`}>
                        <WindowScrubber start={form.start} end={form.end} onChange={(start, end) => setForm({ ...form, start, end })} />
                      </Block>

                      </div>
                      <div className={mStep === 1 ? "" : "max-md:hidden"}>
                      <Block label={t("luggage")} value={`${form.bags} ${form.bags === 1 ? "bag" : "bags"}`}>
                        <div className="flex gap-2" role="radiogroup" aria-label="Number of bags">
                          {[0, 1, 2, 3, 4].map((n) => (
                            <button key={n} type="button" role="radio" aria-checked={form.bags === n} onClick={() => setForm({ ...form, bags: n })} className={`group flex h-14 flex-1 items-end justify-center gap-0.5 rounded-md border pb-2 transition-colors ${form.bags === n ? "border-flare bg-flare/10 text-flare" : "border-text/10 text-muted hover:border-text/25"}`} aria-label={`${n} bags`}>
                              {n === 0 ? <span className="mono text-sm">0</span> : Array.from({ length: n }).map((_, i) => <Bag key={i} />)}
                            </button>
                          ))}
                        </div>
                      </Block>

                      </div>
                      <div className={`grid grid-cols-2 gap-x-6 ${mStep === 2 ? "" : "max-md:hidden"}`}>
                        <Block label={t("maxWait")} value={`${form.maxWait} min`}>
                          <Seg options={[5, 10, 15, 20, 30]} value={form.maxWait} onChange={(v) => setForm({ ...form, maxWait: v })} label="Maximum wait in minutes" />
                        </Block>
                        <Block label={t("maxDetour")} value={`${form.maxDetour} min`}>
                          <Seg options={[5, 10, 15, 20]} value={form.maxDetour} onChange={(v) => setForm({ ...form, maxDetour: v })} label="Maximum detour in minutes" />
                        </Block>
                      </div>

                      <div className={mStep === 3 ? "" : "max-md:hidden"}>
                      <Block label={t("flight")} value={form.flight || "—"}>
                        <input value={form.flight} onChange={(e) => setForm({ ...form, flight: e.target.value.toUpperCase() })} placeholder="6E 2134" aria-label="Flight number (optional)" aria-invalid={!!flightErr} autoComplete="off" className="mono w-full border-b border-text/15 bg-transparent py-2 text-xl tracking-wider outline-none placeholder:text-text/20 focus:border-flare" />
                        {flightErr ? <p className="mt-1.5 text-xs text-bad" role="alert">{flightErr}</p> : <p className="mt-1.5 text-[11px] text-muted">Not synced in the demo.</p>}
                      </Block>

                      </div>
                      {mStep < 3 && (
                        <div className="mt-8 flex gap-2 md:hidden">
                          {mStep > 0 && <button type="button" onClick={() => setMStep(mStep - 1)} className="btn btn-ghost">{t("back")}</button>}
                          <button type="button" onClick={() => { buzz(8); setMStep(mStep + 1); }} className="btn btn-primary flex-1">{t("next")} <span aria-hidden>→</span></button>
                        </div>
                      )}
                      <div className={mStep === 3 ? "" : "max-md:hidden"}>
                      <Magnetic strength={0.12}>
                        <button type="submit" disabled={loading} className="btn btn-primary mt-8 !min-h-14 w-[min(100%,calc(100vw-2.5rem))] text-base sm:w-[25rem]">
                          {loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" aria-hidden />Running hard constraints…</> : <>{t("find")} <span aria-hidden>→</span></>}
                        </button>
                      </Magnetic>
                      {mStep === 3 && <button type="button" onClick={() => setMStep(2)} className="mt-2 min-h-11 text-sm text-muted md:hidden">← Back</button>}
                      </div>
                    </form>
                  )}

                  {/* ---------- 2. DEPARTURES BOARD ---------- */}
                  {screen === "matches" && (
                    <div>
                      <Back onClick={() => setScreen("request")}>Edit trip</Back>
                      <div className="flex items-baseline justify-between">
                        <h3 className="display text-3xl">Shared departures</h3>
                        <span className="mono text-xs text-muted">{result.ranked.length}/{OPEN_GROUPS.length} FEASIBLE</span>
                      </div>
                      <p className="mono mt-2 text-[11px] text-muted">{fmtTime(form.start)}–{fmtTime(form.end)} · {form.bags} BAG · WAIT ≤{form.maxWait} · DETOUR ≤{form.maxDetour}</p>

                      <div className="mood-night mt-6 overflow-hidden rounded-xl bg-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                        <div className="mono grid grid-cols-[3.2rem_3.6rem_2.4rem_3.6rem_1fr] gap-2 border-b border-text/10 px-3 py-2 text-[10px] text-muted">
                          <span>GRP</span><span>DEPART</span><span>PAX</span><span>DETOUR</span><span className="text-right">EST. SHARE</span>
                        </div>
                        <ul>
                          {result.ranked.map((m, i) => {
                            const g = OPEN_GROUPS.find((x) => x.id === m.groupId)!;
                            const open = whyOpen === m.groupId;
                            return (
                              <li key={m.groupId} onMouseEnter={() => setHover(m.groupId)} onFocus={() => setHover(m.groupId)} className={`border-b border-text/5 transition-colors ${hover === m.groupId || (!hover && i === 0) ? "bg-flare/[0.06]" : ""}`}>
                                <div className="mono grid grid-cols-[3.2rem_3.6rem_2.4rem_3.6rem_1fr] items-center gap-2 px-3 pt-3 text-sm">
                                  <span className="text-sodium"><Flap text={g.id} delay={i * 0.15} reduced={reduced} /></span>
                                  <span><Flap text={fmtTime(g.departure)} delay={i * 0.15} reduced={reduced} /></span>
                                  <span>{m.travellers}</span>
                                  <span>+{m.detourMin}M</span>
                                  <span className="text-right text-flare"><Flap text={inr(m.share)} delay={i * 0.15 + 0.1} reduced={reduced} /></span>
                                </div>
                                <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-2">
                                  <span className="mono text-[10px] text-good">{i === 0 ? "● BEST MATCH" : "● MATCH"} · SCORE {m.score.toFixed(1)}</span>
                                  <span className="flex gap-1.5">
                                    <button onClick={() => setWhyOpen(open ? null : m.groupId)} aria-expanded={open} className="mono min-h-9 rounded border border-text/15 px-2.5 text-[11px] hover:bg-text/5">WHY?</button>
                                    <button onClick={() => { setGroupId(m.groupId); setScreen("details"); }} className="mono min-h-9 rounded bg-text px-3 text-[11px] font-semibold text-ink hover:bg-flare">VIEW GROUP →</button>
                                  </span>
                                </div>
                                {open && (
                                  <div className="mx-3 mb-3 border-l-2 border-flare pl-3 text-xs leading-relaxed text-muted">
                                    <p className="text-text">{m.reason}</p>
                                    <p className="mono mt-1.5 text-[10.5px]">ROUTE {m.factors.route.toFixed(2)} · WAIT {m.factors.wait.toFixed(2)} · DETOUR {m.factors.detour.toFixed(2)} · FAIR {m.factors.fairness.toFixed(2)}</p>
                                    <p className="mt-1">Passed every hard constraint: window, corridor, seats, luggage, detour, wait and consent.</p>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                          {result.evaluations.flatMap((e) => e.feasible ? [] : [
                            <li key={e.group.id} className="border-b border-text/5 px-3 py-3 opacity-70">
                              <div className="mono grid grid-cols-[3.2rem_3.6rem_2.4rem_1fr] items-center gap-2 text-sm text-muted">
                                <span>{e.group.id}</span><span>{fmtTime(e.group.departure)}</span><span>{e.group.members.length + 1}</span>
                                <span className="text-right text-[11px] font-semibold text-bad">NOT FEASIBLE</span>
                              </div>
                              <p className="mono mt-1 text-[10.5px] text-bad/80">{e.rejections.map((r) => r.message.toUpperCase()).join(" · ")}</p>
                            </li>,
                          ])}
                        </ul>
                      </div>

                      {!result.ranked.length && (
                        <div className="mt-6 border-l-2 border-sodium pl-4">
                          <p className="font-medium">No compatible group right now.</p>
                          {fix ? (
                            <div className="mt-3 rounded-lg bg-flare/10 p-4">
                              <p className="text-sm"><span className="font-medium">Closest: Group {fix.groupId}</span> fits if you {fix.changes.join(" and ")}.</p>
                              <button onClick={() => { const next = { ...form, maxDetour: fix.maxDetour, maxWait: fix.maxWait, bags: fix.bags }; setForm(next); setLoading(true); setTimeout(() => setLoading(false), 600); }} className="btn btn-primary mt-3 w-full">Apply and search again</button>
                            </div>
                          ) : (
                            <p className="mt-1 text-sm text-muted">No open group fits even with relaxed limits. Get notified when one forms.</p>
                          )}
                          {notify ? (
                            <p className="mt-4 text-sm text-good" role="status">You&apos;ll be notified if a compatible group forms. (Demo: nothing is sent.)</p>
                          ) : (
                            <button onClick={() => setNotify(true)} className="btn btn-primary mt-4 w-full">Notify me when a group forms</button>
                          )}
                        </div>
                      )}
                      <SimBadge className="mt-5">Simulated open groups</SimBadge>
                    </div>
                  )}

                  {/* ---------- 3. GROUP DETAILS ---------- */}
                  {screen === "details" && group && match && (
                    <div>
                      <Back onClick={() => setScreen("matches")}>Back to matches</Back>
                      <p className="mono text-xs text-sodium">GRP {group.id} · BOARDING {group.pickupPoint.toUpperCase()}</p>
                      <h3 className="display mt-3 text-4xl">{group.members.map((m) => m.name).join(" & ")} <span className="text-[#8d90a0]">+ you</span></h3>
                      <div className="mt-6 flex gap-3">
                        {group.members.map((m) => (
                          <div key={m.name} className="flex items-center gap-2.5 rounded-full border border-text/10 py-1 pl-1 pr-3.5">
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-text/20 to-text/5 text-sm">{m.name[0]}</span>
                            <span className="text-sm">{m.name}</span>
                            <span className="text-[11px] text-good">✓ Verified</span>
                          </div>
                        ))}
                      </div>

                      <dl className="mt-8 grid grid-cols-3 border-y border-text/10">
                        {[["DEPART", fmtTime(group.departure)], ["YOUR DETOUR", `+${match.detourMin} MIN`], ["EST. SHARE", inr(match.share)]].map(([k, v], i) => (
                          <div key={k} className={`py-4 ${i ? "border-l border-text/10 pl-4" : ""}`}>
                            <dt className="label !text-[10px]">{k}</dt>
                            <dd className={`mono mt-1 text-xl ${i === 2 ? "text-flare" : ""}`}>{v}</dd>
                          </div>
                        ))}
                      </dl>

                      <p className="label mt-8">DROP SEQUENCE</p>
                      <ol className="relative mt-4 space-y-4 pl-6">
                        <span className="absolute bottom-2 left-[5px] top-2 w-px bg-gradient-to-b from-white via-flare to-taxi" aria-hidden />
                        <li className="relative text-sm"><span className="absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-ink bg-text" />Pickup · {group.pickupPoint}</li>
                        {group.dropOrder.map((d, i) => (
                          <li key={d} className={`relative text-sm ${d === "cyberCity" ? "text-flare" : ""}`}>
                            <span className={`absolute -left-6 top-1 h-3 w-3 border-2 border-ink ${i === group.dropOrder.length - 1 ? "rounded-full bg-taxi" : "rounded-sm bg-flare"}`} />
                            {PLACES[d].name}{d === "cyberCity" ? " · you" : ` · ${group.members.find((m) => m.destination === d)?.name ?? ""}`}
                          </li>
                        ))}
                      </ol>

                      <div className="mt-8 bg-text/[0.03] p-4">
                        <p className="mono text-sm">{inr(group.baseFare)} ÷ {match.travellers} + {inr(group.serviceFee)} fee = <span className="text-flare">{inr(match.share)}</span></p>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted">Estimate, not a guaranteed price.</p>
                      </div>
                      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                        <button onClick={() => setScreen("confirm")} className="btn btn-primary flex-1">{t("join")}</button>
                        <button onClick={() => setScreen("matches")} className="btn btn-ghost">Back to matches</button>
                      </div>
                    </div>
                  )}

                  {/* ---------- 4. RIDE PASS: CONFIRM + STATUS ---------- */}
                  {(screen === "confirm" || screen === "status") && group && match && (
                    <div>
                      {screen === "confirm" && <Back onClick={() => setScreen("details")}>Group details</Back>}
                      {screen === "status" ? (
                        // boarding-gate moment: the pass prints out of a slot, then gets stamped
                        <div className="relative">
                          <div className="relative z-10 -mx-1.5 h-3 rounded-full bg-night shadow-[inset_0_-2px_0_rgba(255,255,255,0.15)]" aria-hidden />
                          <div className="-mt-1.5 overflow-hidden pt-1.5">
                            <motion.div initial={reduced ? false : { y: "-100%" }} animate={{ y: 0 }} transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }}>
                              <RidePass group={group} share={match.share} travellers={match.travellers} confirmed />
                            </motion.div>
                          </div>
                        </div>
                      ) : (
                        <RidePass group={group} share={match.share} travellers={match.travellers} confirmed={false} />
                      )}

                      {screen === "confirm" && (
                        <>
                          <div className="mt-6 text-xs leading-relaxed text-muted">
                            <p className="font-medium text-text">Cancellation terms</p>
                            <p className="mt-1">Free cancellation until a driver is assigned. After that a cancellation fee may apply, and it&apos;s shown before you cancel. Demo terms {TERMS_VERSION}.</p>
                          </div>
                          <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
                            <input type="checkbox" checked={shareTrip} onChange={(e) => setShareTrip(e.target.checked)} className="mt-0.5 shrink-0" />
                            <span>Share my trip status with a trusted contact <span className="text-muted">(optional)</span></span>
                          </label>
                          {shareTrip && <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact's name" className="field mt-3" aria-label="Trusted contact name" maxLength={40} />}
                          <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
                            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 shrink-0" required />
                            <span>I agree to share this ride with {group.members.map((m) => m.name).join(" and ")}, to show them my first name and drop-off area, and to the cancellation terms above.</span>
                          </label>
                          <button onClick={confirm} disabled={!consent} className="btn btn-primary mt-6 !min-h-14 w-full">Confirm and join</button>
                          {!consent && <p className="mt-2 text-center text-xs text-muted">Tick the consent box to continue.</p>}
                        </>
                      )}

                      {screen === "status" && (
                        <>
                          <div className="mt-7 flex items-center justify-between">
                            <p className="label">{t("whatNext")}</p>
                            <SimBadge>Demo</SimBadge>
                          </div>
                          <ol className="mt-4 space-y-3 text-sm">
                            {[
                              [t("now"), t("next1", { g: group.id })],
                              [t("whenLand"), t("next2", { p: group.pickupPoint })],
                              [t("afterDrop"), t("next3", { s: inr(match.share) })],
                            ].map(([t, d], i) => (
                              <motion.li key={t} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.12 }} className="flex gap-3">
                                <span className="mono mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-flare/15 text-[11px] text-flare">{i + 1}</span>
                                <span><span className="font-medium">{t}.</span> <span className="text-muted">{d}</span></span>
                              </motion.li>
                            ))}
                          </ol>
                          <div className="mt-6 grid grid-cols-2 gap-2">
                            <button onClick={() => setHelp(true)} className="btn border border-bad/40 bg-bad/10 text-bad hover:bg-bad/15">Help</button>
                            <button onClick={share} className="btn btn-ghost">Share trip</button>
                          </div>
                          {record && <p className="mono mt-5 text-[10.5px] text-muted">CONSENT RECORDED {new Date(record.acceptedAt).toLocaleTimeString()} · TERMS {record.termsVersion}</p>}
                          <button onClick={reset} className="mt-3 min-h-11 text-sm text-muted underline-offset-4 hover:text-text hover:underline">Start a new trip</button>
                        </>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
              <AnimatePresence>
                {toast && (
                  <motion.p role="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed inset-x-5 bottom-5 z-50 mx-auto max-w-md rounded-lg border border-text/10 bg-surface px-4 py-3 text-sm shadow-2xl">
                    {toast}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      </div>
      <HelpDialog open={help} onClose={() => setHelp(false)} />
    </section>
  );
}

/** Boarding-pass style ride pass with perforation and an animated CONFIRMED stamp. */
function RidePass({ group, share, travellers, confirmed }: { group: Group; share: number; travellers: number; confirmed: boolean }) {
  const cells: [string, string][] = [["PASSENGER", "YOU"], ["GROUP", `GRP ${group.id}`], ["PAX", String(travellers)], ["DEPART", fmtTime(group.departure)], ["BOARDING", group.pickupPoint.split(",")[0].toUpperCase()], ["EST. FARE", inr(share)]];
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-white to-[#f1ece2] ring-1 ring-text/10 text-night shadow-[0_30px_80px_-30px_rgba(166,118,58,0.28)]">
      <div className="flex items-end justify-between p-5 pb-4">
        <div><p className="mono text-[10px] text-night/60">FROM</p><p className="font-sans text-4xl font-bold tracking-[-0.04em]">DEL</p><p className="mono text-[10px] text-night/60">T3 ARRIVALS</p></div>
        <svg viewBox="0 0 60 12" className="mb-6 w-14 text-night/50" aria-hidden><path d="M1 6h52" stroke="currentColor" strokeDasharray="2 3" /><path d="M50 2l6 4-6 4" fill="none" stroke="currentColor" /></svg>
        <div className="text-right"><p className="mono text-[10px] text-night/60">TO</p><p className="font-sans text-4xl font-bold tracking-[-0.04em]">CYB</p><p className="mono text-[10px] text-night/60">CYBER CITY</p></div>
      </div>
      {/* perforation */}
      <div className="relative h-5" aria-hidden>
        <span className="absolute -left-2.5 top-0 h-5 w-5 rounded-full bg-ink" />
        <span className="absolute -right-2.5 top-0 h-5 w-5 rounded-full bg-ink" />
        <span className="absolute inset-x-4 top-1/2 border-t-2 border-dashed border-ink/20" />
      </div>
      <dl className="grid grid-cols-3 gap-x-3 gap-y-3 p-5 pt-3">
        {cells.map(([k, v]) => (
          <div key={k}><dt className="mono text-[9.5px] text-night/55">{k}</dt><dd className="mono mt-0.5 text-sm font-semibold">{v}</dd></div>
        ))}
      </dl>
      <div className="flex items-center justify-between border-t border-ink/10 px-5 py-2.5">
        <span className="mono text-[9.5px] text-night/55">AIRPOOL RIDE PASS · DEMO · NOT A TICKET</span>
        <span className="flex h-5 items-end gap-[2px]" aria-hidden>{Array.from({ length: 26 }).map((_, i) => <span key={i} className="bg-night" style={{ width: (i * 7) % 3 ? 1 : 2, height: `${60 + ((i * 37) % 40)}%` }} />)}</span>
      </div>
      <AnimatePresence>
        {confirmed && (
          <motion.div initial={{ scale: 2.4, opacity: 0, rotate: -24 }} animate={{ scale: 1, opacity: 1, rotate: -12 }} transition={{ type: "spring", stiffness: 260, damping: 16, delay: 1.05 }} className="mono pointer-events-none absolute bottom-14 right-5 rounded border-[3px] border-[#13865a] px-3 py-1 text-lg font-bold tracking-widest text-[#13865a]">
            CONFIRMED
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Dual-handle kerb window on a 17:00–20:00 timeline, with open-group departures marked. */
function WindowScrubber({ start, end, onChange }: { start: number; end: number; onChange: (s: number, e: number) => void }) {
  const pct = (m: number) => ((m - T_MIN) / (T_MAX - T_MIN)) * 100;
  return (
    <div className="relative pt-9">
      {[...OPEN_GROUPS].filter((g) => g.departure <= T_MAX).sort((a, b) => a.departure - b.departure).map((g, i) => (
        <span key={g.id} className="mono absolute -translate-x-1/2 text-center text-[9.5px] text-muted" style={{ left: `${pct(g.departure)}%`, top: i % 2 ? 0 : -12 }} title={`Group ${g.id} departs ${fmtTime(g.departure)}`}>
          {g.id}<span className="mx-auto mt-0.5 block w-px bg-text/30" style={{ height: i % 2 ? 8 : 20 }} />
        </span>
      ))}
      <div className="relative h-9">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-text/15" />
        {Array.from({ length: 13 }).map((_, i) => <span key={i} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-text/20" style={{ left: `${(i / 12) * 100}%` }} />)}
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-flare shadow-[0_0_16px_rgba(255,138,61,0.6)]" style={{ left: `${pct(start)}%`, width: `${pct(end) - pct(start)}%` }} />
        <input type="range" className="dual" min={T_MIN} max={T_MAX} step={5} value={start} onChange={(e) => onChange(Math.min(+e.target.value, end - 10), end)} aria-label="Kerb window start" aria-valuetext={fmtTime(start)} />
        <input type="range" className="dual" min={T_MIN} max={T_MAX} step={5} value={end} onChange={(e) => onChange(start, Math.min(Math.max(+e.target.value, start + 10), start + 120))} aria-label="Kerb window end" aria-valuetext={fmtTime(end)} />
      </div>
      <div className="mono mt-1 flex justify-between text-[10px] text-muted"><span>17:00</span><span>18:00</span><span>19:00</span><span>20:00</span></div>
    </div>
  );
}

function Block({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="mt-7 border-t border-text/10 pt-4">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="label">{label.toUpperCase()}</span>
        <span className="mono text-sm text-text">{value}</span>
      </div>
      {children}
    </div>
  );
}
function Seg({ options, value, onChange, label }: { options: number[]; value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-text/10" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={`mono min-h-11 flex-1 text-sm transition-colors ${value === o ? "bg-text text-ink" : "text-muted hover:bg-text/5 hover:text-text"}`}>{o}</button>
      ))}
    </div>
  );
}
function Back({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className="mono mb-5 -ml-1 flex min-h-9 items-center gap-1.5 px-1 text-xs text-muted hover:text-text"><span aria-hidden>←</span>{String(children).toUpperCase()}</button>;
}
function Bag() {
  return (
    <svg width="12" height="18" viewBox="0 0 12 18" fill="none" aria-hidden>
      <rect x="1" y="4" width="10" height="13" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 4V1.5h4V4M4 8v6M8 8v6" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
