#!/usr/bin/env node
// Prints site/material-asus-router.pdf.html to a phone-size PDF with a locally installed Chrome or Edge.
//   node scripts/build-pdf.mjs [siteDir]      (default: site)
// Set CHROME_PATH to choose a browser. Exits with code 2 and a clear message when none is found.
import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const siteDir = path.resolve(process.cwd(), process.argv[2] || 'site');
const input = path.join(siteDir, 'material-asus-router.pdf.html');
const output = path.join(siteDir, 'material-asus-router.pdf');

function candidates() {
  const list = [];
  if (process.env.CHROME_PATH) list.push(process.env.CHROME_PATH);
  if (process.platform === 'win32') {
    for (const base of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)) {
      list.push(path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
  } else if (process.platform === 'darwin') {
    list.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium');
  } else {
    for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
      const found = spawnSync('which', [name], { encoding: 'utf8' });
      if (found.status === 0 && found.stdout.trim()) list.push(found.stdout.trim());
    }
  }
  return list;
}

if (!existsSync(input)) {
  console.error(`The print page is missing: ${input}\nRun "node scripts/build-site.mjs ${path.basename(siteDir)}" first.`);
  process.exit(1);
}
const browser = candidates().find((file) => existsSync(file));
if (!browser) {
  console.error('No Chrome, Edge or Chromium was found, so the PDF was not made.\nInstall one of them, or set CHROME_PATH to its executable, then run this script again.');
  process.exit(2);
}
const args = [
  '--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--generate-pdf-document-outline', '--virtual-time-budget=8000',
  `--print-to-pdf=${output}`, pathToFileURL(input).href,
];
if (process.env.CI || process.getuid?.() === 0) args.unshift('--no-sandbox');
const profile = mkdtempSync(path.join(tmpdir(), 'mar-pdf-'));
args.unshift(`--user-data-dir=${profile}`);
const result = spawnSync(browser, args, { encoding: 'utf8', timeout: 180000, windowsHide: true });
try { rmSync(profile, { recursive: true, force: true }); } catch { /* temporary profile */ }
if (!existsSync(output) || statSync(output).size < 1000) {
  console.error(`The browser did not produce a PDF (exit ${result.status}).\n${(result.stderr || '').slice(-600)}`);
  process.exit(1);
}
console.log(`PDF written: ${output} (${Math.round(statSync(output).size / 1024)} KB) using ${path.basename(browser)}`);
