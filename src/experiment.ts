/**
 * @title DualSet Interference Exp3
 * @description Inspecting the impact of a random vs an ABBA testing sequence on dual-set interference in WM
 * @author Noah Rischert, Chenyu Li and Hannah (Dames) Tschannen
 * @version 0.3.2
 *
 *
 * @assets assets/
 */

// import stylesheets (.scss or .css).
import "../styles/main.scss";

// jsPsych official plugin
import preload from "@jspsych/plugin-preload";

// Global variables
import { jsPsych } from "./jsp";

// screens
import { welcome_screen } from "./instructions/welcome";
import { consent_screen, notice_screen } from "./instructions/consent";
import { browser_screen } from "./instructions/browserCheck";
import { fullMode_screen, closeFullScreen } from "./instructions/fullScreen";
import { initializeAndAssignSubjectID } from "./task-fun/participantID";
import { survey_screen } from "./ending/questionnaire";
import { debrief_screen } from "./ending/debriefing";
import { instructionSlidesConfig } from "./instructions/InstrStart";
import jsPsychCallFunction from '@jspsych/plugin-call-function';
import { buildExperimentNode } from "./trials/runExperiment";

/**
 * This function will be executed by jsPsych Builder and is expected to run the jsPsych experiment
 *
 * @type {import("jspsych-builder").RunFunction}
 */
export async function run({
  assetPaths,
  input = {},
  environment,
  title,
  version,
}) {
  // Initialize a timeline to hold the trials
  var timeline: any[] = [];

  // Preload assets
  const preloadSlides = {
    type: preload,
    max_load_time: 30000,
    images: [
      "assets/instructionImages/Slide1.gif",
      "assets/instructionImages/Slide2.gif",
      "assets/instructionImages/Slide3.gif",
      "assets/instructionImages/Slide4.gif",
      "assets/instructionImages/Slide5.gif",
      "assets/instructionImages/Slide6.gif"
    ],
    show_progress_bar: true,
  };

  /* pre-task screens */
  timeline.push(
    preloadSlides,
    welcome_screen,
    consent_screen,
    notice_screen,
    fullMode_screen,
    browser_screen,
    instructionSlidesConfig,      
  );

  timeline.push({
    type: jsPsychCallFunction,
    async: true,                         // ← tell jsPsych to wait
    func: async (done) => {              // ← done = resume button
      const participantID = await initializeAndAssignSubjectID();
      jsPsych.data.addProperties({ subject: participantID });
  
      const expNode = buildExperimentNode(participantID);
  
      jsPsych.addNodeToEndOfTimeline({
        timeline: [
          expNode,                       // task
          survey_screen,                 // post-task screens
          debrief_screen,
          closeFullScreen,
        ],
      });
  
      done();                            // ← now jsPsych may continue
    },
  });
  
  await jsPsych.run(timeline);
}
