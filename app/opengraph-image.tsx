// Share card for WhatsApp / LinkedIn / X: brand mark, promise and corridor.
import { ImageResponse } from "next/og";

export const alt = "AirPool — many travellers, one ride. Delhi Airport T3 → Gurugram.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0f3d34", color: "#f7f7f4", padding: 80 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="64" height="80" viewBox="0 0 40 50" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 46 C5 36 19 33 20 24 M35 46 C35 36 21 33 20 24" stroke="#b8935a" strokeWidth="3.6" />
            <path d="M20 46 V5 M12 13 L20 5 L28 13" stroke="#f7f7f4" strokeWidth="3.6" />
          </svg>
          <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: -2 }}>AirPool</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, lineHeight: 1.02, letterSpacing: -3 }}>Same airport. Same direction.</div>
          <div style={{ fontSize: 84, lineHeight: 1.02, letterSpacing: -3, color: "#d9b77a" }}>One shared ride.</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#b8c7c1", letterSpacing: 2 }}>
          <span>MANY TRAVELLERS · ONE RIDE</span>
          <span>DEL T3 → GURUGRAM · EARLY ACCESS</span>
        </div>
      </div>
    ),
    size,
  );
}
