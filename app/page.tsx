import Nav from "@/components/Nav";
import Chrome from "@/components/Chrome";
import Journey from "@/components/Journey";
import MapStory from "@/components/MapStory";
import Engine from "@/components/Engine";
import Booking from "@/components/Booking";
import { Closing, Faq, Safety } from "@/components/Sections";
import { Kerbside, LaunchScope, MobileCta } from "@/components/Extras";

export default function Home() {
  return (
    <main id="main">
      <a href="#map" className="sr-only z-[60] rounded-lg bg-night px-4 py-3 text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <Chrome />
      <Nav />
      <Journey />
      <Kerbside />
      <MapStory />
      <LaunchScope />
      <Safety />
      <Booking />
      <Engine />
      <Faq />
      <Closing />
      <MobileCta />
    </main>
  );
}
