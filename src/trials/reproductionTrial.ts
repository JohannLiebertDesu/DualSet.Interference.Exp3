/**********************************************************************
 *  featureRecall.ts                                                  *
 *  Probe the two items tagged `tested_first` / `tested_second`.      *
 *********************************************************************/

import psychophysics                       from "@kurokida/jspsych-psychophysics";
import { jsPsych }                         from "../jsp";
import { createColorWheel,
         createOrientationWheel }          from "../task-fun/createWheels";

import { Stimulus,
         LineStimulus,
         CircleStimulus,
         WheelStimulus }                   from "../task-fun/defineStimuli";
import { StimulusKind }                    from "../task-fun/placeStimuli";
import { screenWidth }                     from "../task-fun/createGrid";
import { filterAndMapStimuli }             from "../task-fun/filterStimuli";


/* ─────────── type guards ─────────── */
const isCircleStimulus = (s: Stimulus): s is CircleStimulus => s.obj_type === "circle";
const isLineStimulus   = (s: Stimulus): s is LineStimulus   => s.obj_type === "line";

/* ─────────── wheel helpers ───────── */
function makeColorWheelForProbe(c: CircleStimulus): WheelStimulus {
  const { startX, startY, radius } = c;
  const offset = Math.floor(Math.random() * 360);
  return createColorWheel(startX, startY, radius * 2.7, radius * 1.836, offset);
}
function makeOrientationWheelForProbe(c: CircleStimulus): WheelStimulus {
  const { startX, startY, radius } = c;
  return createOrientationWheel(startX, startY, radius * 2.7, radius * 1.836, 0);
}

const signedDiff360 = (a: number, b: number) => (((a - b + 540) % 360) - 180);

const hueFromHsl = (s?: string | null): number | null => {
  if (!s) return null;
  const m = /^hsla?\(\s*([0-9]+(?:\.[0-9]+)?)\s*,/i.exec(String(s));
  return m ? ((parseFloat(m[1]) % 360) + 360) % 360 : null;
};


/* ─────────── factory ─────────── */
export function featureRecall(
  trialID: number,
  blockID: number,
  practice: boolean,
  numCircles: 3 | 6,
  grouping: "combined" | "split",
  composition: "homogeneous_color" | "homogeneous_orientation" | "mixed",
  layout: "clustered" | "interleaved",
  stimulusTypeShownFirst: StimulusKind,
  forcedFirstKind?: StimulusKind
): any[] {

  /* helper that builds ONE recall screen -------------------------- */
  const makeRecallTrial = (probeIndex: 1 | 2) => {

    /* closure variables shared with the mouse handler */
    let orientedLine : LineStimulus   | undefined;
    let coloredCircle: CircleStimulus | undefined;
    let colorWheel   : WheelStimulus  | undefined;
    let anchorCircle : CircleStimulus;

    return {
      type            : psychophysics,
      response_type   : "mouse",
      background_color: "#FFFFFF",
      post_trial_gap  : probeIndex === 1 ? 100 : 1000,

      stimuli: () => {
        // 1) fetch sample-phase stimuli for THIS logical trial
        const sampleRows = jsPsych.data.get().filter({
          trialID, blockID, practice, trialSegment: "displayStimuli"
        });
        const allStimuli: Stimulus[] = sampleRows.values().flatMap((r: any) => r.stimuliData);
      
        const logicalItem = allStimuli.filter(
          s => s.test_status === (probeIndex === 1 ? "tested_first" : "tested_second")
        );
      
        // 2) anchor + wheel
        const isOrientation = logicalItem.some(isLineStimulus);
      
        const anchorCircle = (isOrientation
          ? logicalItem.find(s =>
              isCircleStimulus(s) && (s as CircleStimulus).fill_color === "transparent"
            ) ?? logicalItem.find(isCircleStimulus)
          : logicalItem.find(isCircleStimulus)) as CircleStimulus;
      
        if (!anchorCircle) throw new Error("Could not locate anchor circle for wheel creation.");
      
        const wheelStim = isOrientation
          ? makeOrientationWheelForProbe(anchorCircle)
          : makeColorWheelForProbe(anchorCircle);
      
        // 3) RETURN display copies that hide the answer until mouse moves
        const displayItem: Stimulus[] = logicalItem.map((obj): Stimulus => {
          if (isLineStimulus(obj)) {
            // collapse the line to hide orientation
            const o = obj as LineStimulus;
            return { ...o, x2: o.x1, y2: o.y1 };
          }
          if (isCircleStimulus(obj)) {
            // neutral circle (no informative color) for both trial types
            const o = obj as CircleStimulus;
            return { ...o, fill_color: "transparent", line_color: "#000000" };
          }
          // fallback (shouldn't happen here): just return the object as-is, no spread
          return obj as Stimulus;
        });
        
      
        return [...displayItem, { ...wheelStim }];
      },

      /* ---------------- mouse handler --------------------------- */
      mouse_move_func(ev: MouseEvent) {
        const t: any = jsPsych.getCurrentTrial();          // jsPsych v7
        const live = t.stim_array as any[];                // plugin's live copies
      
        // locate the live objects currently on canvas for this recall screen
        const liveWheel  = live.find(s => s.obj_type === "manual" && s.category === "customWheel");
        const liveCircle = live.find(isCircleStimulus);
        const liveLine   = live.find(isLineStimulus);
      
        console.log("line properties", liveLine);
        // anchor geometry comes from the circle (center + radius)
        const cx = liveCircle ? liveCircle.startX : undefined;
        const cy = liveCircle ? liveCircle.startY : undefined;
        const R  = liveCircle ? liveCircle.radius : undefined;
      
        const { offsetX, offsetY } = ev;
      
        // ORIENTATION TRIAL (line present)
        if (liveLine && cx !== undefined && cy !== undefined && R !== undefined) {
          // compute mouse angle around the anchor center
          const rad = Math.atan2(offsetY - cy, offsetX - cx);
      
          liveLine.x2 = liveLine.x1 + R * Math.cos(rad);
          liveLine.y2 = liveLine.y1 + R * Math.sin(rad);

          return;
        }
      
        // COLOR TRIAL (no line, but circle + wheel present)
        if (liveCircle && liveWheel && cx !== undefined && cy !== undefined) {
          let deg = Math.atan2(offsetY - cy, offsetX - cx) * 180 / Math.PI;
          if (deg < 0) deg += 360;
          deg = (deg + (liveWheel.offset ?? 0)) % 360;
      
          const hsl = `hsl(${deg}, 80%, 50%)`;
          liveCircle.fill_color = hsl;
          liveCircle.line_color = hsl;
        }
      },
on_finish(data: any) {
  const t: any = jsPsych.getCurrentTrial();
  const live = t.stim_array as any[];

  // keep your snapshot
  const filteredStimuli = live.filter(stim => stim.category !== 'customWheel');
  const processedStimuli = filterAndMapStimuli(filteredStimuli);
  data.stimulusResponse = processedStimuli;

  // side (your code)
  const liveCircle = live.find(isCircleStimulus) as CircleStimulus | undefined;
  if (liveCircle) {
    const midpoint = screenWidth / 2;
    data.side = liveCircle.startX < midpoint ? 'left' : 'right';
  }

  /* ── NEW: derive target (from sample phase) and selected (from recall) ── */
  // fetch the original sample-phase stimuli for THIS logical trial
  const sampleRows = jsPsych.data.get().filter({
    trialID, blockID, practice, trialSegment: "displayStimuli"
  });
  const allSample: Stimulus[] = sampleRows.values().flatMap((r: any) => r.stimuliData);
  const label = (probeIndex === 1) ? "tested_first" : "tested_second";
  const origItems = allSample.filter(s => (s as any).test_status === label);

  const origLine   = origItems.find(isLineStimulus)   as LineStimulus   | undefined;
  const origCircle = origItems.find(isCircleStimulus) as CircleStimulus | undefined;

  const liveLine = live.find(isLineStimulus) as LineStimulus | undefined;
  const liveWheel = live.find((s: any) => s.obj_type === 'manual' && s.category === 'customWheel');

  // Orientation trial
  if (liveLine || origLine) {
    // selected angle from the line drawn on recall
    let selDeg: number | null = null;
    if (liveLine) {
      const dx = (liveLine.x2 ?? liveLine.x1) - liveLine.x1;
      const dy = (liveLine.y2 ?? liveLine.y1) - liveLine.y1;
      selDeg = Math.atan2(dy, dx) * 180 / Math.PI;
      if (selDeg < 0) selDeg += 360;
    }

    // target angle from the original sample-phase line
    let tgtDeg: number | null = null;
    if (origLine) {
      const dx0 = (origLine.x2 ?? origLine.x1) - origLine.x1;
      const dy0 = (origLine.y2 ?? origLine.y1) - origLine.y1;
      tgtDeg = Math.atan2(dy0, dx0) * 180 / Math.PI;
      if (tgtDeg < 0) tgtDeg += 360;
    }

    data.response_kind = "orientation";
    data.target_orientation_deg   = tgtDeg;
    data.selected_orientation_deg = selDeg;
    data.signed_error_deg     = (selDeg != null && tgtDeg != null) ? signedDiff360(selDeg, tgtDeg) : null;

    // keep color-related cols null here for tidy downstream code
    data.target_color_deg   = null;
    data.selected_color_deg = null;
    data.wheel_offset_deg   = null;

    return;
  }

    // Color trial
  if (origCircle || liveCircle) {
    // selected hue from the live circle HSL string
    const selHue = hueFromHsl(liveCircle?.fill_color as any);

    // target hue from the original sample-phase circle
    const tgtHue = hueFromHsl(origCircle?.fill_color as any);

    data.response_kind       = "color";
    data.target_color_deg    = tgtHue;
    data.selected_color_deg  = selHue;
    data.signed_error_deg    = (selHue != null && tgtHue != null)
      ? signedDiff360(selHue, tgtHue)     // keep your 360° signed error
      : null;

    data.wheel_offset_deg    = liveWheel?.offset ?? null;

    // null-out orientation fields
    data.target_orientation_deg   = null;
    data.selected_orientation_deg = null;
    data.signed_error_deg_360     = null;
    return;
  }

},
      /* ---------------- bookkeeping ----------------------------- */
      data: {
        trialID, blockID, practice,
        numCircles, grouping, composition, layout,
        probeIndex,
        trialSegment: "featureRecall",
        stimulusTypeShownFirst, forcedFirstKind, 
      }
    };
  };

  /* return the two probes ---------------------------------------- */
  return [ makeRecallTrial(1), makeRecallTrial(2) ];
}
