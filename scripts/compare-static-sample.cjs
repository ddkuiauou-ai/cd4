#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const normalize = value => value == null ? null : String(value).replace(/\s+/g, ' ').trim();
function text(node) {
  if (!node) return null;
  const copy = node.cloneNode(true);
  for (const svg of copy.querySelectorAll('svg')) svg.remove();
  return normalize(copy.textContent);
}

function resolveStreamedBoundaries(document) {
  // React's $RC instructions move completed server-rendered segments back into
  // the Suspense boundary. Apply that DOM operation without running any script.
  for (const segment of document.querySelectorAll('[id^="S:"]')) {
    const placeholder = document.getElementById(`B:${segment.id.slice(2)}`);
    if (!placeholder) continue;
    const parent = placeholder.parentNode;
    let cursor = placeholder.nextSibling;
    let depth = 0;
    while (cursor) {
      if (cursor.nodeType === 8) {
        if (cursor.data === '/$') {
          if (depth === 0) break;
          depth--;
        } else if (['$', '$?', '$!', '$~'].includes(cursor.data)) depth++;
      }
      const next = cursor.nextSibling;
      parent.removeChild(cursor);
      cursor = next;
    }
    if (!cursor) throw new Error(`Unclosed streamed boundary ${placeholder.id}`);
    placeholder.remove();
    while (segment.firstChild) parent.insertBefore(segment.firstChild, cursor);
    segment.remove();
  }
}

function pageFacts(html) {
  // Hydration scripts contain the full inline history in the benchmark. They do
  // not contribute visible facts, so omit their contents before parsing. JSDOM
  // never executes scripts or loads remote resources here.
  const documentHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg\s*>/gi, '');
  const dom = new JSDOM(documentHtml);
  try {
    const document = dom.window.document;
    resolveStreamedBoundaries(document);
    const main = document.querySelector('main') || document.body;
    const annual = main.querySelector('#annual-data');
    return {
      title: normalize(document.title),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
      h1: [...main.querySelectorAll('h1')].map(text),
      firstDefinitionList: text(main.querySelector('dl')),
      currentFacts: text(main.querySelector('.detail-summary-grid')),
      currentState: [...main.querySelectorAll('.detail-content > [role="status"], .ranking-main [role="status"]')].map(text),
      indicators: text(main.querySelector('#indicators')),
      annualTables: annual ? [...annual.querySelectorAll('table')].map(text) : [],
      annualDefinitionLists: annual ? [...annual.querySelectorAll('dl')].map(text) : [],
      annualMobileRows: annual ? [...annual.querySelectorAll('.detail-annual-data > ul')].map(text) : [],
      basicInformation: text(main.querySelector('#basic-information')),
      priceInformation: text(main.querySelector('#price-information')),
      companyInformation: text(main.querySelector('#company-information')),
      rankingTables: [...main.querySelectorAll('.ranking-shell table')].map(table => ({
        header: text(table.querySelector('thead')),
        rows: [...table.querySelectorAll('tbody tr')].map(row => [...row.children].map(text)),
      })),
    };
  } finally { dom.window.close(); }
}

async function captureFacts({outputDirectory, manifestFile}) {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const routes = manifest.routes.filter(route => route.kind === 'page').map(route => route.path);
  const facts = {};
  for (let index = 0; index < routes.length; index++) {
    const route = routes[index];
    const filename = path.join(outputDirectory, decodeURIComponent(route).replace(/^\/+/, ''), 'index.html');
    if (!fs.existsSync(filename)) throw new Error(`Missing static route: ${route} (${filename})`);
    facts[route] = pageFacts(fs.readFileSync(filename, 'utf8'));
    // Let each closed window's queued lifecycle work settle before creating the
    // next one. A synchronous loop retains those jobs until all routes finish.
    await new Promise(resolve => setImmediate(resolve));
    if ((index + 1) % 20 === 0 && typeof global.gc === 'function') global.gc();
    if ((index + 1) % 100 === 0) process.stdout.write(`Captured ${index + 1}/${routes.length} routes (${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MiB heap)\n`);
  }
  return {schemaVersion:1, snapshotId:manifest.snapshotId, routeCount:routes.length, capturedAt:new Date().toISOString(), facts};
}

function compareFacts(baseline, current) {
  const routes = [...new Set([...Object.keys(baseline.facts), ...Object.keys(current.facts)])].sort();
  const differences = [];
  for (const route of routes) {
    const before = baseline.facts[route], after = current.facts[route];
    if (!before || !after) { differences.push({route, missing:before ? 'current' : 'baseline'}); continue; }
    const fields = Object.keys(before).filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
    if (fields.length) differences.push({route, fields:fields.map(field=>({field, before:before[field], after:after[field]}))});
  }
  return {schemaVersion:1, success:differences.length===0, comparedAt:new Date().toISOString(),
    baselineSnapshotId:baseline.snapshotId, currentSnapshotId:current.snapshotId, routeCount:routes.length, differences};
}

async function main(args) {
  const readOption = name => { const index=args.indexOf(name); return index < 0 ? undefined : args[index+1]; };
  const captureFile = readOption('--capture'), compareFile = readOption('--compare');
  if (Boolean(captureFile) === Boolean(compareFile)) throw new Error('Use --capture <facts.json> or --compare <baseline.json> [--report <report.json>].');
  const current = await captureFacts({outputDirectory:path.resolve(readOption('--out') || 'out'), manifestFile:path.resolve(readOption('--manifest') || '.static-build/manifest.json')});
  if (captureFile) {
    fs.mkdirSync(path.dirname(path.resolve(captureFile)), {recursive:true});
    fs.writeFileSync(captureFile, JSON.stringify(current, null, 2) + '\n');
    process.stdout.write(`Saved default HTML facts for ${current.routeCount} routes to ${captureFile}\n`);
    return;
  }
  const baseline = JSON.parse(fs.readFileSync(compareFile, 'utf8'));
  const report = compareFacts(baseline, current);
  const reportFile = readOption('--report');
  if (reportFile) {fs.mkdirSync(path.dirname(path.resolve(reportFile)), {recursive:true});fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');}
  for (const difference of report.differences.slice(0, 20)) process.stdout.write(`${difference.route}: ${difference.missing || difference.fields.map(value=>value.field).join(', ')}\n`);
  process.stdout.write(`${report.success?'PASS':'FAIL'}: ${report.routeCount} routes; ${report.differences.length} changed default HTML facts\n`);
  if (!report.success) process.exitCode = 1;
}

if (require.main === module) main(process.argv.slice(2)).catch(error => {process.stderr.write(`${error.message}\n`);process.exitCode=1;});
module.exports = {pageFacts, captureFacts, compareFacts, resolveStreamedBoundaries};
