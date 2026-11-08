# AirPool AI

Premium interactive website + working prototype for shared airport rides.
Demo corridor: Delhi Airport T3 → Cyber City, Gurugram.

```bash
npm install        # also copies the MapLibre worker into public/
npm run dev        # http://localhost:3000
npm test           # matching engine, waitlist validation and waitlist store self-checks (node, no framework)
node scripts/e2e.mjs [390 844]   # booking-demo end-to-end in real Chrome (dev server running)
npm run build
npm run routes     # re-fetch real road geometry from OSRM into data/routes.json
npm run osm        # re-fetch OSM airport/roads/buildings for the 3D world into data/osm-corridor.json
```

## What's real and what's simulated
- **Real:** map tiles & 3D buildings (OpenStreetMap via OpenFreeMap), place coordinates (Nominatim), road geometry/distance/free-flow time (OSRM), committed in `data/routes.json`. The 3D journey's runways, taxiways, aprons, roads, parks, water and building footprints/heights are real OSM data decoded from OpenFreeMap vector tiles (`data/osm-corridor.json`).
- **Approximated:** T3's massing (absent from the tiles; fitted into the real apron void), procedural buildings where OSM has none (aligned to real streets), trees, traffic, parked aircraft; the star/constellation sequence is a visual metaphor, not data.
- **Simulated (labelled in the UI):** riders, groups, departures, detours, driver assignment, ride status, incident reports. Fares ₹450 / ₹150 are the pitch's illustrative example. 78.7M passengers is the pitch figure, flagged for verification.

## Structure
| Path | What |
|---|---|
| `lib/matching.ts` | Hard constraints → weighted scoring → templated explanations; pool pipeline. Pure, no UI. |
| `lib/matching.test.ts` | Assert-based checks (Group C excluded at 10-min detour, every constraint fires, fare split). |
| `lib/demo-data.ts` | Synthetic open groups A–G and a deterministic 48-request pool across 3 corridors. |
| `lib/geo.ts` | Places, routes, geo helpers. |
| `components/three/` | Procedural airliner (painted livery), daylight OSM-built world (`world.ts`: buildings, trees, traffic, sun shadows), the light-to-star particle system (`stars.ts`), and the scroll-driven journey scene. |
| `components/Extras.tsx` | Bilingual T3 wayfinding sign, MVP launch scope, early-access waitlist form, tilting ride pass. |
| `app/api/waitlist/route.ts`, `lib/waitlist*.ts`, `lib/db.ts` | Early-access signups: validated, de-duplicated, stored in SQLite (`data/airpool.db`, gitignored; Node 22 built-in `node:sqlite`). Confirmation email via Resend when configured. |
| `app/admin/route.ts` | `/admin`: password-protected demand view (signups by area, arrival time, frequency) + CSV export. |
| `components/CorridorMap.tsx` | MapLibre 3D map with markers, route draw, vehicle, toggles, SVG fallback. |
| `components/Engine.tsx` | Radar-scope visual of the matching engine, computed live. |
| `components/Booking.tsx` | 4-screen booking flow (request → departures board → group → ride pass/status). |

## Config
- `NEXT_PUBLIC_MAP_STYLE_URL` — optional MapLibre style URL (e.g. MapTiler/Mapbox-compatible style with your key). Defaults to OpenFreeMap (no key).
- `OSRM_URL` — optional routing server for `npm run routes`.

No backend, payments, dispatch, or flight sync. The LLM layer is not wired: match reasons are templated from computed numbers.

## MVP scope
v1 is one corridor (DEL T3 arrivals → Gurugram), shared cabs of 2–4 via a partner fleet, constraint-based matching, upfront fare split, and consent/safety basics. Deliberately out of v1: solo rides, live dispatch tracking, flight-status sync, in-app payments, other corridors, rides to the airport.

## Configuration
Copy `.env.example` to `.env.local`. Everything is optional; unset features switch off cleanly:
- `ADMIN_PASSWORD`: enables `/admin` (HTTP Basic auth, any username).
- `RESEND_API_KEY` + `EMAIL_FROM`: waitlist confirmation emails.
- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`: cookieless analytics (section views, waitlist signups, demo bookings).
- `NEXT_PUBLIC_SITE_URL`: canonical URL for link previews and email links.

SQLite needs a server with a persistent disk (a VPS, Railway, Render, Fly). For Vercel/serverless, move `lib/waitlist-store.ts` to Postgres (Supabase/Neon): it's the only file that touches storage.
