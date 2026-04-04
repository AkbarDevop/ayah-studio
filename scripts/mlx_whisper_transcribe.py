#!/usr/bin/env python3
import json
import sys


def transcribe_with_transformers(audio_path: str, model_id: str) -> dict:
    import torch
    from transformers import (
        AutoModelForSpeechSeq2Seq,
        AutoProcessor,
        GenerationConfig,
        pipeline,
    )

    device = "mps" if torch.backends.mps.is_available() else "cpu"

    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        model_id, dtype=torch.float32, low_cpu_mem_usage=True
    )
    model.to(device)
    processor = AutoProcessor.from_pretrained(model_id)

    # Older Whisper fine-tunes have outdated generation configs.
    # Load a known-good config from the base model and apply it.
    base_model = model_id.split("/")[-1].replace("-ar-quran", "")
    try:
        model.generation_config = GenerationConfig.from_pretrained(f"openai/{base_model}")
    except Exception:
        pass

    pipe = pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        dtype=torch.float32,
        device=device,
    )

    # Try word-level timestamps, fall back to chunk-level, then no timestamps
    for ts_mode in ("word", True, False):
        try:
            result = pipe(
                audio_path,
                return_timestamps=ts_mode if ts_mode is not False else None,
                generate_kwargs={"language": "ar", "task": "transcribe"},
            )
            break
        except (ValueError, RuntimeError):
            if ts_mode is False:
                raise
            continue

    full_text = (result.get("text") or "").strip()
    segments: list[dict] = []
    words_out: list[dict] = []

    for chunk in result.get("chunks", []) or []:
        text = (chunk.get("text") or "").strip()
        ts = chunk.get("timestamp", [None, None])
        if text and ts and len(ts) == 2 and ts[0] is not None:
            start = float(ts[0])
            end = float(ts[1]) if ts[1] is not None else start + 0.3
            if end > start:
                words_out.append({"word": text, "start": start, "end": end})

    # Group word-level chunks into segments (split on pauses > 0.8s)
    if words_out:
        current_seg_words: list[dict] = [words_out[0]]
        for w in words_out[1:]:
            if w["start"] - current_seg_words[-1]["end"] > 0.8:
                seg_text = " ".join(sw["word"] for sw in current_seg_words)
                segments.append(
                    {
                        "text": seg_text,
                        "start": current_seg_words[0]["start"],
                        "end": current_seg_words[-1]["end"],
                        "words": current_seg_words,
                    }
                )
                current_seg_words = [w]
            else:
                current_seg_words.append(w)
        if current_seg_words:
            seg_text = " ".join(sw["word"] for sw in current_seg_words)
            segments.append(
                {
                    "text": seg_text,
                    "start": current_seg_words[0]["start"],
                    "end": current_seg_words[-1]["end"],
                    "words": current_seg_words,
                }
            )

    return {"text": full_text, "segments": segments}


def transcribe_with_mlx_whisper(audio_path: str, model_id: str) -> dict:
    import mlx_whisper

    result = mlx_whisper.transcribe(
        audio_path,
        path_or_hf_repo=model_id,
        language="ar",
        task="transcribe",
        word_timestamps=True,
    )

    segments = []
    for segment in result.get("segments", []) or []:
        start = segment.get("start")
        end = segment.get("end")
        text = (segment.get("text") or "").strip()

        if (
            text
            and isinstance(start, (int, float))
            and isinstance(end, (int, float))
            and end > start
        ):
            words = []
            for w in segment.get("words", []) or []:
                w_text = (w.get("word") or "").strip()
                w_start = w.get("start")
                w_end = w.get("end")
                if (
                    w_text
                    and isinstance(w_start, (int, float))
                    and isinstance(w_end, (int, float))
                    and w_end > w_start
                ):
                    words.append(
                        {"word": w_text, "start": float(w_start), "end": float(w_end)}
                    )

            segments.append(
                {"text": text, "start": float(start), "end": float(end), "words": words}
            )

    return {"text": (result.get("text") or "").strip(), "segments": segments}


def main() -> int:
    if len(sys.argv) < 3:
        print(
            json.dumps(
                {"error": "usage: mlx_whisper_transcribe.py <audio_path> <model>"}
            ),
            file=sys.stderr,
        )
        return 2

    audio_path = sys.argv[1]
    model = sys.argv[2]

    if model.startswith("mlx-community/"):
        result = transcribe_with_mlx_whisper(audio_path, model)
    else:
        result = transcribe_with_transformers(audio_path, model)

    if not result["text"]:
        print("No transcript text produced.", file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
