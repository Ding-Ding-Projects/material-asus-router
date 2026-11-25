# Contributing

1. Install Node.js 22 or newer, then run `npm install`.
2. Start the app against the built-in fake router: `npm run demo`, then open http://localhost:8790/.
3. Run the tests: `npm test`. They use the fake router, so no real router is needed.
4. Keep every router write inside the change engine (preview, confirm, undo). Never pass browser
   input to the router shell.
5. Interface changes start on the design canvas in `design/canvas/` and are then built to match.

Pull requests should describe the behaviour changed and how it was verified.
