// Runs one search off the page so a slow pattern can be stopped. The page
// terminates this worker if it does not answer within its time limit.
import { replaceText, runMatches } from "./engine.js";

self.onmessage = (event) => {
  const { id, kind, args } = event.data;
  try {
    self.postMessage({ id, result: kind === "replace" ? replaceText(...args) : runMatches(...args) });
  } catch (error) {
    self.postMessage({ id, result: { ok: false, error: { en: error.message, yue: error.message } } });
  }
};
