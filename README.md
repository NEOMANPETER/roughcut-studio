# RoughCut Studio v2 (Complete GitHub-Ready Premiere UXP Plugin)

This repository is **100% self-contained** with `manifest.json`, `package.json`, build/packaging scripts, and a GitHub Actions workflow so GitHub builds your `.ccx` installer immediately without failing on missing files.

## Included Features
1. **Safety Sequence Backup & Padding Controls**: Automatically clones your active sequence before cutting and applies customizable pre-speech and post-speech padding (`0.15s` default) inside undoable Premiere transactions.
2. **Actual Timeline Cutting**: Imports `silences.json` (from `local-engine/detect_silence.py`) and ripple-deletes silent gaps across your sequence.
3. **B-Roll & Beat Arranger**: Finds your `B-Roll` bin in the Project panel, trims clips to your chosen BPM and beat count, and places them onto Track `V2` alongside beat markers.

## How to Generate the `.ccx` Installer on GitHub
1. Upload all files in this folder to a new GitHub repository.
2. Go to the **Actions** tab on GitHub -> click **Build and Release CCX** -> click **Run workflow** (or push a tag: `git tag v1.0.0 && git push origin v1.0.0`).
3. Download `RoughCut-Studio-v1.0.0.ccx` from **Actions Artifacts** or **Releases** and double-click it to install into Premiere Pro (v25.6+).
