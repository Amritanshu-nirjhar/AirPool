// Custom analytics events. No-op unless the Plausible script is loaded (NEXT_PUBLIC_PLAUSIBLE_DOMAIN set).
type Plausible = (event: string, opts?: { props?: Record<string, string | number> }) => void;
export function track(event: string, props?: Record<string, string | number>) {
  if (typeof window === "undefined") return;
  (window as unknown as { plausible?: Plausible }).plausible?.(event, props ? { props } : undefined);
}
