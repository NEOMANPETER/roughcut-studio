import json
import sys
from faster_whisper import WhisperModel


def transcribe_local(audio_path: str, local_model_dir: str, out_json: str) -> None:
    model = WhisperModel(
        local_model_dir,
        device="cpu",
        compute_type="int8",
    )
    segments, _ = model.transcribe(audio_path, vad_filter=True)
    results = [
        {"start": round(seg.start, 3), "end": round(seg.end, 3), "text": seg.text.strip()}
        for seg in segments
    ]
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python transcribe_offline.py <audio_path> <model_dir> <out_json>")
        sys.exit(1)
    transcribe_local(sys.argv[1], sys.argv[2], sys.argv[3])
