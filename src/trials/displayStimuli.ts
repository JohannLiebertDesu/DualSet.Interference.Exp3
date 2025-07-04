/* displayStimuli.ts  – run-time stimulus generation (option B) */
import psychophysics                                 from "@kurokida/jspsych-psychophysics";
import { generateStimuli, StimulusSpec, StimulusKind } from "../task-fun/placeStimuli";
import { createGrid, numColumns, numRows, cellSize   } from "../task-fun/createGrid";
import { Stimulus                                    } from "../task-fun/defineStimuli";

/* ───────── helpers ───────── */

function randomStimulusPair(): [StimulusKind, StimulusKind] {
  return Math.random() < 0.5
    ? ["colored_circle", "oriented_circle"]
    : ["oriented_circle", "colored_circle"];
}

function stimulusKind(stim: Stimulus): StimulusKind {
  if (stim.obj_type === "line") return "oriented_circle";
  return (stim as any).fill_color === "transparent"
    ? "oriented_circle"
    : "colored_circle";
}

/* ───────── factory ───────── */

export function displayStimuli(
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

  /* 1 ─ specs for each logical screen ----------------------------- */
  let specsBlock1: StimulusSpec[] = [];
  let specsBlock2: StimulusSpec[] = [];

  if (numCircles === 3) {
    specsBlock1 = [{
      count : 3, side : "left",
      stimulusType: composition === "homogeneous_orientation"
        ? "oriented_circle" : "colored_circle"
    }];
  } else if (grouping === "combined") {

    if (composition !== "mixed") {
      const stim = composition === "homogeneous_orientation"
        ? "oriented_circle" : "colored_circle";
      specsBlock1 = [
        { count: 3, side: "left",  stimulusType: stim },
        { count: 3, side: "right", stimulusType: stim }
      ];

    } else if (layout === "clustered") {
      specsBlock1 = [
        { count: 3, side: "left",  stimulusType: stimulusTypeShownFirst },
        { count: 3, side: "right",
          stimulusType: stimulusTypeShownFirst === "colored_circle"
            ? "oriented_circle" : "colored_circle" }
      ];

    } else { // mixed + interleaved
      const [typeA, typeB] = randomStimulusPair();
      specsBlock1 = [
        { count: 2, side: "left",  stimulusType: typeA },
        { count: 1, side: "left",  stimulusType: typeB },
        { count: 1, side: "right", stimulusType: typeA },
        { count: 2, side: "right", stimulusType: typeB }
      ];
    }

  } else { // 6 items, grouping === "split"
    specsBlock1 = [{ count: 3, side: "left",  stimulusType: stimulusTypeShownFirst }];
    specsBlock2 = [{
      count: 3, side: "right",
      stimulusType: stimulusTypeShownFirst === "colored_circle"
        ? "oriented_circle" : "colored_circle"
    }];
  }

  const blocksSpecs: StimulusSpec[][] = [];
  if (specsBlock1.length) blocksSpecs.push(specsBlock1);
  if (specsBlock2.length) blocksSpecs.push(specsBlock2);

  /* 2 ─ shared closure state -------------------------------------- */
  let placedBlocks: Stimulus[][] = [];   // created once, reused for both screens

  /* 3 ─ build jsPsych trials -------------------------------------- */
  return blocksSpecs.map((specsThisScreen, screenIdx) => ({

    type: psychophysics,

    /* ----------  KEY CHANGE: generate stimuli up-front ---------- */
    stimuli: () => {
      if (placedBlocks.length === 0) {             // first screen only
        const grid = createGrid(numColumns, numRows);
        placedBlocks = blocksSpecs.map(specs =>
          generateStimuli(grid, specs,
                          cellSize.cellWidth, cellSize.cellHeight)
        );
      }
      return placedBlocks[screenIdx];              // hand array to plugin
    },

    choices         : "NO_KEYS",
    background_color: "#FFFFFF",

    /* duration can be dynamic, too */
    trial_duration  : () => numCircles * 100,      // 100 ms per item

    /* -------- fine-tune timing, no stimulus mutation ----------- */
    on_start(trial: any) {

      const placed       = trial.stimuli;          // already validated
      const currentType  = specsThisScreen[0].stimulusType;
      let   isi          = 0;

      if (numCircles === 3 && currentType === stimulusTypeShownFirst) {
        isi = 2300;
      } else if (numCircles === 3) {
        isi = 1000;
      } else if (numCircles === 6 && grouping === "split") {
        isi = 1000;
      } else if (
        grouping === "combined" &&
        layout   === "clustered" &&
        currentType === stimulusTypeShownFirst
      ) {
        isi = 2000;
      } else if (grouping === "combined" && layout === "clustered") {
        isi = 1000;
      } else if (grouping === "combined" && layout === "interleaved") {
        const firstTestStim = placed.find(
          (s: Stimulus) => (s as any).test_status === "tested_first"
        );
        const firstTestKind = firstTestStim ? stimulusKind(firstTestStim) : null;
        isi = firstTestKind === stimulusTypeShownFirst ? 2000 : 1000;
      }

      trial.post_trial_gap = isi;
    },

    /* -------------- bookkeeping --------------------------------- */
    on_finish(data: any) {
      data.stimuliData = placedBlocks[screenIdx];
    },

    data: {
      trialID, blockID, practice,
      part: screenIdx + 1,      // 1 or 2
      numCircles, grouping, composition, layout,
      trialSegment: "displayStimuli",
      stimulusTypeShownFirst, forcedFirstKind
    }
  }));
}
