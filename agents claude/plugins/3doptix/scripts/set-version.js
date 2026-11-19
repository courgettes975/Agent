#!/usr/bin/env node
/**
 * set-version.js — Write one version into every store manifest.
 *
 * Zero dependencies. Usage:
 *   node scripts/set-version.js 1.1.0
 *
 * Four manifests each carry their own version field. Editing them by hand drifts; this writes
 * all four, and `node scripts/validate.js` fails if they ever disagree.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PLUGIN_NAME = '3doptix';
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const version = process.argv[2];

if (!version) {
  console.error('Usage: node scripts/set-version.js <version>');
  process.exit(1);
}
if (!SEMVER.test(version)) {
  console.error(`"${version}" is not a semver version (e.g. 1.1.0).`);
  process.exit(1);
}

/** Each target says where its version lives, so adding a store means adding one entry. */
const setEntryVersion = doc => {
  const entry = (doc.plugins || []).find(p => p.name === PLUGIN_NAME);
  if (!entry) throw new Error(`no "${PLUGIN_NAME}" entry`);
  entry.version = version;
};

const TARGETS = [
  { file: '.claude-plugin/plugin.json', set: doc => { doc.version = version; } },
  { file: '.codex-plugin/plugin.json', set: doc => { doc.version = version; } },
  { file: 'server.json', set: doc => { doc.version = version; } },
  { file: '.claude-plugin/marketplace.json', set: setEntryVersion },
  { file: '.agents/plugins/marketplace.json', set: setEntryVersion },
];

for (const { file, set } of TARGETS) {
  const abs = path.join(ROOT, file);
  const doc = JSON.parse(fs.readFileSync(abs, 'utf8'));
  set(doc);
  fs.writeFileSync(abs, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`  ${file}`);
}

console.log(`\nAll manifests set to ${version}. Commit, then tag: git tag v${version}`);
