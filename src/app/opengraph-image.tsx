import { ImageResponse } from "next/og";

export const alt = "Ayah Studio — Quran Video Subtitle Editor";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0C0F14",
          fontFamily: "sans-serif",
        }}
      >
        {/* Decorative border */}
        <div
          style={{
            position: "absolute",
            inset: "20px",
            border: "1px solid rgba(212, 168, 83, 0.2)",
            borderRadius: "16px",
            display: "flex",
          }}
        />

        {/* Logo icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "32px",
          }}
        >
          <svg width="80" height="80" viewBox="0 0 30 30">
            <circle
              cx="15"
              cy="15"
              r="13"
              fill="none"
              stroke="#D4A853"
              strokeWidth="1.0"
            />
            <polygon
              points="15,4 18,12 15,10 12,12"
              fill="#D4A853"
              opacity="0.7"
            />
            <polygon
              points="15,26 18,18 15,20 12,18"
              fill="#D4A853"
              opacity="0.7"
            />
            <polygon
              points="4,15 12,12 10,15 12,18"
              fill="#D4A853"
              opacity="0.7"
            />
            <polygon
              points="26,15 18,12 20,15 18,18"
              fill="#D4A853"
              opacity="0.7"
            />
            <circle cx="15" cy="15" r="3" fill="#D4A853" opacity="0.4" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            fontSize: "64px",
            fontWeight: 700,
            color: "#D4A853",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          Ayah Studio
        </div>

        {/* Subtitle */}
        <div
          style={{
            display: "flex",
            fontSize: "24px",
            fontWeight: 400,
            color: "#8A8D96",
            marginTop: "16px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Quran Video Subtitle Editor
        </div>

        {/* Description */}
        <div
          style={{
            display: "flex",
            fontSize: "18px",
            color: "#5A5D66",
            marginTop: "40px",
            maxWidth: "600px",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          AI-powered ayah detection, styled Arabic subtitles, SRT & ASS export
        </div>
      </div>
    ),
    { ...size }
  );
}
