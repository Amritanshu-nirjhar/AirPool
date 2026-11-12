import Link from "next/link";
import { Mark } from "@/components/Nav";

export const metadata = { title: "Gate not found · AirPool" };

export default function NotFound() {
  return (
    <main className="mood-night grid min-h-screen place-items-center px-5 text-center">
      <div>
        <div className="flex justify-center"><Mark size={56} stem="#f1ede3" foil /></div>
        <p className="mono mt-8 text-xs tracking-widest text-muted">ERROR 404 · GATE CLOSED</p>
        <h1 className="display mt-4 text-[clamp(3rem,9vw,7rem)]">This gate doesn&apos;t <span className="serif-word foil">exist</span>.</h1>
        <p className="mx-auto mt-6 max-w-sm text-muted">The page you&apos;re looking for has moved or never departed.</p>
        <Link href="/" className="btn btn-primary mt-10">Back to AirPool <span aria-hidden>→</span></Link>
      </div>
    </main>
  );
}
