import json
import re
import subprocess
import sys


def detect_silence(audio_path: str, noise_db: str = "-35dB", min_duration: float = 0.4, out_json: str = "silences.json") -> None:
    cmd = [
        "ffmpeg",
        "-i", audio_path,
        "-af", f"silencedetect=noise={noise_db}:d={min_duration}",
        "-f", "null",
        "-"
    ]
    process = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    output = process.stderr

    starts = [float(m) for m in re.findall(r"silence_start:\s*([0-9.]+)", output)]
    ends = [float(m) for m in re.findall(r"silence_end:\s*([0-9.]+)", output)]

    silences = []
    for idx, start in enumerate(starts):
        end = ends[idx] if idx < len(ends) else None
        if end is not None:
            silences.append({"start": round(start, 3), "end": round(end, 3)})

    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(silences, f, indent=2)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python detect_silence.py <audio_path> [noise_db] [min_duration] [out_json]")
        sys.exit(1)
    detect_silence(
        sys.argv[1],
        sys.argv[2] if len(sys.argv) > 2 else "-35dB",
        float(sys.argv[3]) if len(sys.argv) > 3 else 0.4,
        sys.argv[4] if len(sys.argv) > 4 else "silences.json"
    )
