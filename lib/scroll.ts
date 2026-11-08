// Programmatic scrolling that cooperates with Lenis smooth scroll (falls back to native smooth scroll).
type LenisLike = { scrollTo: (target: number | string | HTMLElement, opts?: { duration?: number }) => void };
export function scrollToY(y: number) {
  const lenis = (window as unknown as { __lenis?: LenisLike }).__lenis;
  if (lenis) lenis.scrollTo(y, { duration: 1.4 });
  else window.scrollTo({ top: y, behavior: "smooth" });
}
