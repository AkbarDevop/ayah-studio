#!/usr/bin/env python3
import json
import sys

import mlx_whisper


def main() -> int:
    if len(sys.argv) < 3:
        print(
            json.dumps({"error": "usage: mlx_whisper_transcribe.py <audio_path> <model>"}),
            file=sys.stderr,
        )
        return 2

    audio_path = sys.argv[1]
    model = sys.argv[2]

    result = mlx_whisper.transcribe(
        audio_path,
        path_or_hf_repo=model,
        language="ar",
        task="transcribe",
    )

    segments = []
    for segment in result.get("segments", []) or []:
        start = segment.get("start")
        end = segment.get("end")
        text = (segment.get("text") or "").strip()

        if text and isinstance(start, (int, float)) and isinstance(end, (int, float)) and end > start:
            segments.append(
                {
                    "text": text,
                    "start": float(start),
                    "end": float(end),
                }
            )

    print(
        json.dumps(
            {
                "text": (result.get("text") or "").strip(),
                "segments": segments,
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
