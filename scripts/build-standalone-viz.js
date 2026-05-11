#!/usr/bin/env node
/**
 * Build a self-contained knowledge-space-viz.html with the JSON data inlined.
 * This allows opening the file directly in a browser without a local server.
 */

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'knowledge-space-viz.html');
const jsonPath = path.join(__dirname, '..', 'gse-knowledge-space.json');
const outputPath = path.join(__dirname, '..', 'knowledge-space-viz-standalone.html');

const html = fs.readFileSync(htmlPath, 'utf-8');
const json = fs.readFileSync(jsonPath, 'utf-8');

// Find the loadData function and replace the fetch with inline data
const oldPattern = /async function loadData\(\) \{\n    try \{\n      const res = await fetch\('gse-knowledge-space\.json'\);\n      rawGraph = await res\.json\(\);\n    \} catch \(err\) \{[\s\S]*?\n      return;\n    \}/;

const newCode = `async function loadData() {
    // Use inlined data to avoid CORS issues when opening via file://
    rawGraph = ${json.trim()};`

if (!oldPattern.test(html)) {
  console.error('Could not find the expected fetch pattern in knowledge-space-viz.html');
  process.exit(1);
}

const output = html.replace(oldPattern, newCode);
fs.writeFileSync(outputPath, output);

const stats = fs.statSync(outputPath);
console.log(`Built standalone visualization:`);
console.log(`  Output: ${outputPath}`);
console.log(`  Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Open this file directly in any browser — no server required.`);
