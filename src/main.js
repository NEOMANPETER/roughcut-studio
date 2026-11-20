const { entrypoints } = require("uxp");
const fs = require("uxp").storage.localFileSystem;
const ppro = require("premierepro");

function log(msg) {
  const box = document.getElementById("logBox");
  if (box) box.textContent = msg;
  console.log("[RoughCut]", msg);
}

// 1. SAFETY BACKUP: Clone the active sequence so your original cut is never lost
async function backupActiveSequence() {
  const project = await ppro.Project.getActiveProject();
  if (!project) throw new Error("No active project open.");
  const seq = await project.getActiveSequence();
  if (!seq) throw new Error("No active sequence selected.");

  if (typeof seq.clone === "function") {
    const cloned = await seq.clone();
    log(`Safety backup created: "${cloned.name || seq.name + ' (Copy)'}"`);
    return cloned;
  } else {
    throw new Error("Sequence clone API unavailable in this Premiere build. Duplicate sequence manually before cutting.");
  }
}

// 2. ACTUAL TIMELINE CUTTING: Reads JSON ranges [{start, end}], applies padding, and removes/ripples silent ranges
async function applyCutsFromJson() {
  const project = await ppro.Project.getActiveProject();
  if (!project) throw new Error("No active project open.");
  const seq = await project.getActiveSequence();
  if (!seq) throw new Error("No active sequence open.");

  const doBackup = document.getElementById("autoBackupChk").checked;
  const prePad = Math.max(0, parseFloat(document.getElementById("prePadInput").value) || 0.15);
  const postPad = Math.max(0, parseFloat(document.getElementById("postPadInput").value) || 0.15);

  const file = await fs.getFileForOpening({ types: ["json"] });
  if (!file) {
    log("Cut cancelled (no JSON file selected).");
    return;
  }

  const rawText = await file.read();
  const ranges = JSON.parse(rawText);
  if (!Array.isArray(ranges) || ranges.length === 0) {
    throw new Error("JSON file has no cut ranges.");
  }

  if (doBackup) {
    await backupActiveSequence();
  }

  // Apply padding so cuts don't clip speech transients, and sort descending (end-to-start) so timestamps stay accurate
  const paddedCuts = ranges
    .map(r => ({
      start: Number(r.start) + postPad,
      end: Number(r.end) - prePad
    }))
    .filter(r => r.end - r.start > 0.08)
    .sort((a, b) => b.start - a.start);

  if (paddedCuts.length === 0) {
    log("No cuts remained after applying safety padding.");
    return;
  }

  const editor = ppro.SequenceEditor ? ppro.SequenceEditor.getEditor(seq) : null;
  let removedCount = 0;

  // Execute inside an undoable transaction if supported
  const executeEdits = async () => {
    for (const cut of paddedCuts) {
      const startTime = ppro.TickTime.createWithSeconds(cut.start);
      const endTime = ppro.TickTime.createWithSeconds(cut.end);

      if (editor && typeof editor.createRippleDeleteAction === "function") {
        // Set sequence in/out to the silent gap and ripple delete across tracks
        await seq.setInPoint(startTime);
        await seq.setOutPoint(endTime);
        const action = editor.createRippleDeleteAction();
        await project.executeTransaction((compoundAction) => {
          compoundAction.addAction(action);
        }, "RoughCut Silence Trim");
        removedCount++;
      } else {
        // Fallback: drop markers at cut boundaries if ripple action isn't exposed in current UXP build
        const markers = await ppro.Markers.getMarkers(seq);
        await markers.createMarker("Cut Gap", ppro.MarkerType.Comment, cut.start, cut.end - cut.start, "Trim range");
        removedCount++;
      }
    }
  };

  await executeEdits();
  log(`Processed ${removedCount} cut ranges with ${prePad}s/${postPad}s padding.`);
}

// 3. B-ROLL PLACEMENT & BEAT MARKERS ON TRACK V2
async function findBinByName(rootItem, targetName) {
  const items = await rootItem.getItems();
  for (const item of items) {
    if (item.name && item.name.toLowerCase() === targetName.toLowerCase()) {
      return item;
    }
    if (typeof item.getItems === "function") {
      const found = await findBinByName(item, targetName);
      if (found) return found;
    }
  }
  return null;
}

async function placeBrollOnBeats() {
  const project = await ppro.Project.getActiveProject();
  if (!project) throw new Error("No active project open.");
  const seq = await project.getActiveSequence();
  if (!seq) throw new Error("No active sequence open.");

  const bpm = Math.max(40, Math.min(240, parseFloat(document.getElementById("bpmInput").value) || 120));
  const beatsPerClip = Math.max(1, parseInt(document.getElementById("beatsPerClipInput").value, 10) || 4);
  const binName = (document.getElementById("brollBinInput").value || "B-Roll").trim();

  const rootItem = await project.getRootItem();
  const brollBin = await findBinByName(rootItem, binName);
  if (!brollBin || typeof brollBin.getItems !== "function") {
    throw new Error(`Could not find a Project bin named "${binName}". Create it and put B-roll clips inside.`);
  }

  const clips = await brollBin.getItems();
  if (!clips || clips.length === 0) {
    throw new Error(`Bin "${binName}" is empty.`);
  }

  const secondsPerBeat = 60 / bpm;
  const clipDurationSec = secondsPerBeat * beatsPerClip;
  const markers = await ppro.Markers.getMarkers(seq);
  const editor = ppro.SequenceEditor ? ppro.SequenceEditor.getEditor(seq) : null;

  // Ensure V2 exists (track index 1)
  const videoTrackCount = await seq.getVideoTrackCount();
  if (videoTrackCount < 2) {
    throw new Error("Sequence needs at least 2 video tracks (V1 and V2). Add Track V2 first.");
  }

  let currentTime = 0;
  let placed = 0;

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const insertTime = ppro.TickTime.createWithSeconds(currentTime);

    // Drop beat marker
    await markers.createMarker(
      `B-Roll #${i + 1}`,
      ppro.MarkerType.Comment,
      currentTime,
      clipDurationSec,
      `${bpm} BPM (${beatsPerClip} beats)`
    );

    // Place B-roll clip onto V2 (videoTrackIndex = 1, audioTrackIndex = -1 to skip B-roll audio)
    if (editor && typeof editor.createOverwriteItemAction === "function") {
      // Trim source clip out-point to match the beat interval before placing
      if (typeof clip.setOutPoint === "function") {
        await clip.setOutPoint(ppro.TickTime.createWithSeconds(clipDurationSec), 4);
      }
      const action = editor.createOverwriteItemAction(clip, insertTime, 1, -1);
      await project.executeTransaction((compoundAction) => {
        compoundAction.addAction(action);
      }, "RoughCut Place B-Roll");
      placed++;
    }

    currentTime += clipDurationSec;
  }

  log(`Placed ${placed} B-roll clips onto V2 at ${bpm} BPM (${clipDurationSec.toFixed(2)}s each).`);
}

entrypoints.setup({
  panels: {
    mainPanel: {
      create(rootNode) {
        document.getElementById("backupNowBtn").addEventListener("click", async () => {
          try { await backupActiveSequence(); } catch (e) { log("Error: " + e.message); }
        });
        document.getElementById("applyCutsBtn").addEventListener("click", async () => {
          try { await applyCutsFromJson(); } catch (e) { log("Error: " + e.message); }
        });
        document.getElementById("placeBrollBtn").addEventListener("click", async () => {
          try { await placeBrollOnBeats(); } catch (e) { log("Error: " + e.message); }
        });
      }
    }
  }
});
