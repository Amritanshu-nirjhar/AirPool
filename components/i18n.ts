"use client";
// हिन्दी / English for the hero, booking flow and pickup instructions. A tiny external store (no context, no
// hydration mismatch): the server always renders English; the saved choice is applied on the client.
import { useSyncExternalStore } from "react";

export type Lang = "en" | "hi";
const KEY = "airpool-lang";
const listeners = new Set<() => void>();
const read = (): Lang => {
  try {
    return localStorage.getItem(KEY) === "hi" ? "hi" : "en";
  } catch {
    return "en";
  }
};
export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch { /* private mode: still switch for this page view */ }
  document.documentElement.lang = l;
  listeners.forEach((f) => f());
}
const subscribe = (f: () => void) => (listeners.add(f), () => listeners.delete(f));
export const useLang = () => useSyncExternalStore(subscribe, read, () => "en" as Lang);

const STRINGS = {
  hero1: ["Same airport.", "एक ही एयरपोर्ट।"],
  hero2: ["Same direction.", "एक ही दिशा।"],
  hero3: ["One smarter ride.", "एक समझदार सवारी।"],
  heroSub: [
    "Your journey shouldn't cost more just because you're travelling alone. AirPool connects airport travellers heading the same way and helps them split the ride.",
    "अकेले सफ़र करने की वजह से आपका किराया ज़्यादा नहीं होना चाहिए। AirPool एक ही दिशा में जा रहे एयरपोर्ट यात्रियों को जोड़ता है और किराया बाँटने में मदद करता है।",
  ],
  ctaAccess: ["Get early access", "अर्ली एक्सेस पाएँ"],
  ctaDemo: ["Try the demo", "डेमो आज़माएँ"],
  bookTitle: ["Book a shared ride from T3.", "T3 से साझा सवारी बुक करें।"],
  bookIntro: ["Try 3 bags or a 5-minute detour and watch groups drop off the board.", "3 बैग या 5 मिनट का चक्कर चुनकर देखें कि कौन-से ग्रुप हट जाते हैं।"],
  kerbWindow: ["Kerb window", "पिकअप का समय"],
  luggage: ["Luggage", "सामान"],
  maxWait: ["Max wait", "अधिकतम इंतज़ार"],
  maxDetour: ["Max detour", "अधिकतम चक्कर"],
  flight: ["Flight (optional)", "फ़्लाइट (वैकल्पिक)"],
  find: ["Find shared rides", "साझा सवारी खोजें"],
  next: ["Next", "आगे"],
  back: ["Back", "पीछे"],
  question: ["QUESTION", "प्रश्न"],
  of: ["OF", "/"],
  join: ["Join this ride", "इस सवारी में शामिल हों"],
  whatNext: ["WHAT HAPPENS NEXT", "आगे क्या होगा"],
  now: ["Now", "अभी"],
  whenLand: ["When you land", "उतरने पर"],
  afterDrop: ["After drop-off", "ड्रॉप के बाद"],
  next1: ["Seat held with Group {g}. Co-travellers see your first name only.", "ग्रुप {g} में आपकी सीट रखी गई है। सह-यात्री सिर्फ़ आपका पहला नाम देखते हैं।"],
  next2: ["Walk to {p}. Your group and car details appear here.", "{p} पर पहुँचें। ग्रुप और कार की जानकारी यहीं दिखेगी।"],
  next3: ["Pay your share, {s}. No surge, no rebooking.", "अपना हिस्सा, {s}, चुकाएँ। न सर्ज, न दोबारा बुकिंग।"],
} as const;
export type Key = keyof typeof STRINGS;

export function useT() {
  const lang = useLang();
  return (k: Key, vars: Record<string, string> = {}) =>
    Object.entries(vars).reduce<string>((s, [v, x]) => s.replaceAll(`{${v}}`, x), STRINGS[k][lang === "hi" ? 1 : 0]);
}
