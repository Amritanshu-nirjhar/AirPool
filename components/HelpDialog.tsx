"use client";
// Help & incident reporting. Support contact and incident submission are simulated in the demo;
// the emergency link dials India's real emergency number 112.
import { useEffect, useRef, useState } from "react";
import { SimBadge } from "./ui";

export default function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"menu" | "report" | "sent" | "support">("menu");
  const [kind, setKind] = useState("");
  const [details, setDetails] = useState("");
  const [ref_, setRef] = useState("");

  useEffect(() => {
    const d = ref.current!;
    if (open && !d.open) { setMode("menu"); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(440px,calc(100%-2rem))] rounded-2xl border border-text/10 bg-ink-2 p-0 text-text backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      aria-labelledby="help-title"
    >
      <div className="p-6">
        <div className="flex items-start justify-between">
          <h3 id="help-title" className="font-display text-xl">Help</h3>
          <button onClick={onClose} className="-mr-2 -mt-1 grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-text/5 hover:text-text" aria-label="Close help">✕</button>
        </div>

        {mode === "menu" && (
          <div className="mt-5 space-y-2">
            <a href="tel:112" className="flex min-h-14 items-center justify-between rounded-xl border border-bad/40 bg-bad/10 px-4 text-bad">
              <span className="font-medium">Emergency — call 112</span><span aria-hidden>→</span>
            </a>
            <button onClick={() => setMode("support")} className="flex min-h-14 w-full items-center justify-between rounded-xl border border-text/10 px-4 text-left hover:bg-text/5">
              <span>Contact AirPool support</span><span aria-hidden>→</span>
            </button>
            <button onClick={() => setMode("report")} className="flex min-h-14 w-full items-center justify-between rounded-xl border border-text/10 px-4 text-left hover:bg-text/5">
              <span>Report an incident</span><span aria-hidden>→</span>
            </button>
          </div>
        )}

        {mode === "support" && (
          <div className="mt-5">
            <SimBadge>Demo</SimBadge>
            <p className="mt-3 text-sm leading-relaxed text-muted">Demo: no call or message is sent.</p>
            <button onClick={() => setMode("menu")} className="btn btn-ghost mt-5 w-full">Back</button>
          </div>
        )}

        {mode === "report" && (
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setRef(`INC-${Math.random().toString(36).slice(2, 7).toUpperCase()}`);
              setMode("sent");
            }}
          >
            <label className="block text-sm">
              <span className="text-muted">What happened?</span>
              <select required value={kind} onChange={(e) => setKind(e.target.value)} className="field mt-1.5">
                <option value="" disabled>Choose a category</option>
                <option>Safety concern</option>
                <option>Co-traveller behaviour</option>
                <option>Driver or vehicle</option>
                <option>Route or detour</option>
                <option>Fare or payment</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-muted">Details (optional)</span>
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={500} className="field mt-1.5 py-3" />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode("menu")} className="btn btn-ghost flex-1">Back</button>
              <button className="btn btn-primary flex-1">Submit report</button>
            </div>
          </form>
        )}

        {mode === "sent" && (
          <div className="mt-5">
            <p className="text-good">Report recorded · <span className="mono">{ref_}</span></p>
            <p className="mt-2 text-sm text-muted">Simulated: in this demo the report isn&apos;t sent or stored.</p>
            <button onClick={onClose} className="btn btn-primary mt-5 w-full">Done</button>
          </div>
        )}
      </div>
    </dialog>
  );
}
