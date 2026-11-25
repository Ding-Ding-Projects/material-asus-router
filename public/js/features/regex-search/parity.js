// The hand-written parity ledger: one line per topic of a complete regular
// expression workbench, with the engine it is bound to and its honest state.
// "done" means implemented and tested here; anything else is unfinished.
// Dated 2026-11-25. The sources are the public language documentation of the
// ECMAScript RegExp object and the browser's own engine.
export const LEDGER_DATE = "2026-11-25";
export const ENGINE = "ECMAScript RegExp (the browser's own engine)";
export const LEDGER = [
  { topic: "construction", state: "done", note: "Pattern field, token palette, flags, live validation." },
  { topic: "explanation", state: "done", note: "Token-by-token explanation tree in English and Cantonese." },
  { topic: "testing", state: "done", note: "Test text, highlighted matches, groups, truncation notice." },
  { topic: "replacement", state: "done", note: "Replace preview with $1, $<name>, $& and $$; never changes real data." },
  { topic: "collections", state: "done", note: "Built-in samples and a library of saved patterns kept in this browser." },
  { topic: "history", state: "done", note: "Last 20 patterns per search box, kept in this browser." },
  { topic: "integration", state: "done", note: "Every search box gets its own adjacent builder with independent state." },
  { topic: "limits", state: "done", note: "Pattern, text and match limits; runs in a worker that is stopped after 500 ms." },
  { topic: "flavour-comparison", state: "unfinished", note: "Only the JavaScript flavour exists." },
  { topic: "flavour-conversion", state: "unfinished", note: "Needs more than one flavour." },
  { topic: "tracing", state: "unfinished", note: "No step-by-step engine trace." },
  { topic: "benchmarking", state: "unfinished", note: "Not built." },
  { topic: "code-generation", state: "unfinished", note: "Not built." },
  { topic: "safe-grep", state: "unfinished", note: "A web page cannot search files on disk." },
  { topic: "preferences", state: "partial", note: "Flags and mode are remembered per box; no global preference screen yet." },
];
