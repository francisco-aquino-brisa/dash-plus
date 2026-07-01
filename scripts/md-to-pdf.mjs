// Convert a Markdown file to a clean, professional PDF.
// Usage: node scripts/md-to-pdf.mjs <input.md> [output.pdf]
//
// Pipeline: Markdown -> HTML (marked, GFM) -> styled HTML -> PDF (headless Chrome).
// No network; uses the locally installed Google Chrome / Brave.

import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { marked } from "marked";

const input = process.argv[2];
if (!input) {
  console.error("usage: node scripts/md-to-pdf.mjs <input.md> [output.pdf]");
  process.exit(1);
}
const inPath = resolve(input);
const outPath = resolve(process.argv[3] ?? inPath.replace(/\.md$/i, ".pdf"));
const tmpHtml = outPath.replace(/\.pdf$/i, ".tmp.html");

const CHROMES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];
const chrome = CHROMES.find((p) => existsSync(p));
if (!chrome) {
  console.error("No Chromium-based browser found for PDF rendering.");
  process.exit(1);
}

marked.setOptions({ gfm: true, breaks: false });
const body = marked.parse(readFileSync(inPath, "utf8"));

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>${basename(inPath)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
    color: #1f2430; font-size: 11pt; line-height: 1.5; margin: 0;
  }
  h1 { font-size: 20pt; margin: 0 0 4pt; color: #c2410c; }
  h2 { font-size: 14pt; margin: 20pt 0 6pt; padding-bottom: 4pt;
       border-bottom: 1.5px solid #f0cdb6; color: #9a3412; }
  h3 { font-size: 12pt; margin: 14pt 0 4pt; color: #1f2430; }
  p { margin: 6pt 0; }
  code { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 9.5pt;
         background: #f4f1ee; padding: 1px 4px; border-radius: 3px; color: #b4530e; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 9.5pt; }
  th, td { border: 1px solid #e3ded8; padding: 5pt 7pt; text-align: left; vertical-align: top; }
  th { background: #faf3ee; font-weight: 600; }
  tr:nth-child(even) td { background: #fbfaf9; }
  ul, ol { margin: 6pt 0; padding-left: 20pt; }
  li { margin: 3pt 0; }
  hr { border: none; border-top: 1px solid #e3ded8; margin: 16pt 0; }
  li::marker { color: #c2410c; }
  input[type=checkbox] { margin-right: 6px; }
  em { color: #6b7280; }
  table code { background: #f4f1ee; }
</style></head>
<body>${body}</body></html>`;

writeFileSync(tmpHtml, html);

try {
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-pdf-header-footer",
      `--print-to-pdf=${outPath}`,
      `file://${tmpHtml}`,
    ],
    { stdio: "ignore" },
  );
  console.log(`PDF gerado: ${outPath}`);
} finally {
  rmSync(tmpHtml, { force: true });
}
