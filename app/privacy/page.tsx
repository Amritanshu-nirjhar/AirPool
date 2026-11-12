import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Nav";

const PRIVACY_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? "";

export const metadata: Metadata = { title: "Privacy · AirPool", description: "What AirPool's early-access waitlist collects and why." };

export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-16 md:py-24">
      <Logo />
      <h1 className="display mt-14 text-5xl">Privacy</h1>
      <p className="mt-4 text-muted">Early-access waitlist · last updated 1 November 2026</p>
      <div className="mt-10 space-y-8 leading-relaxed">
        <section>
          <h2 className="font-display text-2xl">What we collect</h2>
          <p className="mt-2 text-muted">Your email address, the Gurugram area you&apos;re heading to, how often you fly into Delhi, and when you usually land. Nothing else: no IP address, device data or tracking cookies are stored with your signup.</p>
        </section>
        <section>
          <h2 className="font-display text-2xl">Why</h2>
          <p className="mt-2 text-muted">To tell you when AirPool launches on the Delhi T3 → Gurugram corridor, and to decide launch hours and areas from aggregate demand. We don&apos;t sell or share it, and we don&apos;t send marketing beyond launch updates.</p>
        </section>
        <section>
          <h2 className="font-display text-2xl">How long</h2>
          <p className="mt-2 text-muted">Until launch plus 12 months, or until you ask us to delete it, whichever is sooner.</p>
        </section>
        <section>
          <h2 className="font-display text-2xl">Your rights</h2>
          <p className="mt-2 text-muted">You can ask to see, correct or delete your data at any time, in line with India&apos;s Digital Personal Data Protection Act, 2023. Contact: {PRIVACY_EMAIL ? <a className="mono text-text underline underline-offset-2" href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> : <span className="mono text-warn">contact address is set before launch (NEXT_PUBLIC_PRIVACY_EMAIL)</span>}.</p>
        </section>
      </div>
      <Link href="/" className="btn btn-ghost mt-14">← Back to AirPool</Link>
    </main>
  );
}
