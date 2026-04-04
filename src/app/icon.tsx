import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "32px",
          height: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0C0F14",
          borderRadius: "6px",
        }}
      >
        <svg width="26" height="26" viewBox="0 0 30 30">
          <circle
            cx="15"
            cy="15"
            r="13"
            fill="none"
            stroke="#D4A853"
            strokeWidth="1.4"
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
    ),
    { ...size }
  );
}
