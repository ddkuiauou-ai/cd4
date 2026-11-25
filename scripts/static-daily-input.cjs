const fs = require('node:fs');
const path = require('node:path');
const { businessDate } = require('../lib/data/dto.ts');

const securityKey = 'security_latest/krx-all';
const companyKey = 'company_marketcap/krx-all';

function publicationHeads(publications) {
  return Object.fromEntries(publications.map(row => [row.publicationKey, {
    asOf: businessDate(row.asOf), revision: String(row.revision), calculationId: row.calculationId, ruleRef: row.ruleRef,
  }]));
}

function planDailyPublication({ previous, publications, expectedDay }) {
  const heads = publicationHeads(publications);
  const current = heads[securityKey];
  const old = previous?.sourcePublications?.[securityKey];
  if (!previous || previous.sample?.enabled || !old?.asOf) return { requiresFull: true, reason: 'missing-previous-full' };
  if (!current) return { unchanged: true, reason: 'publication-missing' };
  const equal = Object.entries(heads).every(([key, value]) => {
    const prior = previous.sourcePublications?.[key];
    return value.asOf === prior?.asOf && value.revision === prior.revision
      && (!prior.calculationId || value.calculationId === prior.calculationId);
  }) && Object.keys(heads).length === Object.keys(previous.sourcePublications ?? {}).length;
  if (equal) {
    if (expectedDay && current.asOf < expectedDay) return { unchanged: true, reason: 'publication-not-advanced', expectedDay, from: old.asOf };
    if (!expectedDay || expectedDay === current.asOf) return { unchanged: true, reason: 'same-publication', day: current.asOf };
  }
  if (expectedDay && expectedDay !== current.asOf && current.asOf !== old.asOf) {
    return { requiresFull: true, reason: 'publication-day-mismatch', expectedDay, day: current.asOf };
  }
  if (current.asOf <= old.asOf) return { requiresFull: true, reason: 'historical-or-same-day-correction', day: current.asOf };
  if (BigInt(current.revision) !== BigInt(old.revision) + 1n) return { requiresFull: true, reason: 'publication-revision-gap', from: old.asOf, day: current.asOf };
  for (const key of [companyKey, ...['marketcap', 'per', 'pbr', 'eps', 'bps', 'div', 'dps'].map(metric => 'security_rank/krx-all/' + metric)]) {
    const value = heads[key];
    const prior = previous.sourcePublications?.[key];
    if (!value || value.asOf !== current.asOf) return { unchanged: true, reason: 'publication-bundle-incomplete', day: current.asOf, key };
    if (!prior || BigInt(value.revision) !== BigInt(prior.revision) + 1n) {
      return { requiresFull: true, reason: 'related-publication-revision-gap', day: current.asOf, key };
    }
  }
  for (const key of Object.keys(previous.sourcePublications ?? {})) {
    if (!heads[key]) return { requiresFull: true, reason: 'publication-removed', key, day: current.asOf };
  }
  for (const [key, value] of Object.entries(heads)) {
    if (value.asOf !== current.asOf) {
      return { requiresFull: true, reason: 'mixed-publication-days', key, day: current.asOf };
    }
    const prior = previous.sourcePublications?.[key];
    if (!prior || BigInt(value.revision) !== BigInt(prior.revision) + 1n) {
      return { requiresFull: true, reason: 'related-publication-revision-gap', key, day: current.asOf };
    }
    if (prior.ruleRef && value.ruleRef !== prior.ruleRef) return { requiresFull: true, reason: 'publication-rule-changed', key, day: current.asOf };
  }
  return { from: old.asOf, day: current.asOf };
}

function readPreviousManifest(directory) {
  if (!directory) return null;
  try { return JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return null; }
}

function mergeBusinessDay(old, additions, previousDay, day) {
  const previous = old.filter(row => row.date <= previousDay);
  for (const row of additions) if (row.date !== day) throw new Error('Daily source returned an unexpected business day');
  return previous.concat(additions);
}

module.exports = { planDailyPublication, publicationHeads, readPreviousManifest, mergeBusinessDay };
