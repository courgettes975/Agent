#!/usr/bin/env node
/**
 * validate.js — Check this repository is safe to publish and install.
 *
 * Zero dependencies; run it with `node scripts/validate.js`.
 *
 * Every store clones this repo directly, and the Claude plugin directory mirrors pushes to
 * main automatically, so a broken manifest reaches users without anyone reviewing it. These are
 * the checks that catch that.
 *
 * `.claude-plugin/plugin.json` holds the authoritative version; the other manifests must agree.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKILLS_DIR = path.join(ROOT, 'skills');
const PLUGIN_NAME = '3doptix';

const errors = [];
const notes = [];

const fail = msg => errors.push(msg);
const note = msg => notes.push(msg);

function readJson(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    fail(`${rel} is missing`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    fail(`${rel} is not valid JSON: ${err.message}`);
    return null;
  }
}

/** Minimal frontmatter reader — enough for `key: value` and quoted values. */
function readFrontmatter(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    fields[kv[1]] = kv[2].trim().replace(/^["'](.*)["']$/, '$1');
  }
  return fields;
}

// ---------------------------------------------------------------- skills

/**
 * Limits come from the Agent Skills specification (agentskills.io), which every store
 * implements. Breaking them can mean a skill silently fails to load rather than erroring.
 */
function validateSkills() {
  if (!fs.existsSync(SKILLS_DIR)) {
    fail('skills/ directory is missing');
    return [];
  }

  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  if (dirs.length === 0) fail('skills/ contains no skills');

  for (const dir of dirs) {
    const skillMd = path.join(SKILLS_DIR, dir, 'SKILL.md');

    if (!fs.existsSync(skillMd)) {
      fail(`skills/${dir}/ has no SKILL.md`);
      continue;
    }

    const fm = readFrontmatter(skillMd);
    if (!fm) {
      fail(`skills/${dir}/SKILL.md has no YAML frontmatter`);
      continue;
    }

    if (!fm.name) {
      fail(`skills/${dir}/SKILL.md frontmatter has no "name"`);
    } else {
      if (fm.name !== dir) {
        fail(`skills/${dir}/SKILL.md declares name "${fm.name}" but must match its directory`);
      }
      if (fm.name.length > 64) {
        fail(`skills/${dir}: name is ${fm.name.length} chars, limit is 64`);
      }
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fm.name)) {
        fail(`skills/${dir}: name must be lowercase alphanumeric with single hyphens`);
      }
    }

    if (!fm.description) {
      fail(`skills/${dir}/SKILL.md frontmatter has no "description"`);
    } else if (fm.description.length > 1024) {
      fail(`skills/${dir}: description is ${fm.description.length} chars, limit is 1024`);
    } else {
      note(`skills/${dir}  description ${fm.description.length}/1024 chars`);
    }
  }

  return dirs;
}

// ---------------------------------------------------------------- mcp server

/**
 * The single most damaging mistake this repo could make is publishing a credential, so check
 * for one explicitly rather than trusting review. The server uses OAuth with dynamic client
 * registration; it needs no headers at all.
 */
function validateMcp() {
  const mcp = readJson('.mcp.json');
  if (!mcp) return;

  const names = Object.keys(mcp);
  if (names.includes('mcpServers')) {
    fail('.mcp.json must not wrap servers in "mcpServers" — in a plugin the server name is top level');
  }

  for (const name of names) {
    const server = mcp[name];

    if (server.headers || server.env) {
      fail(`.mcp.json: server "${name}" declares headers/env — this repo is public, and the server uses OAuth`);
    }
    const serialised = JSON.stringify(server);
    if (/api[-_]?key|token|secret|bearer/i.test(serialised)) {
      fail(`.mcp.json: server "${name}" mentions a credential field`);
    }
    if (server.url && !server.url.startsWith('https://')) {
      fail(`.mcp.json: server "${name}" url must be https`);
    }
    if (server.url) note(`.mcp.json  ${name} -> ${server.url}`);
  }
}

// ---------------------------------------------------------------- manifests

function validateManifests(skillDirs) {
  const plugin = readJson('.claude-plugin/plugin.json');
  const marketplace = readJson('.claude-plugin/marketplace.json');
  const agents = readJson('.agents/plugins/marketplace.json');
  const codex = readJson('.codex-plugin/plugin.json');
  const server = readJson('server.json');

  if (!plugin || !marketplace || !agents || !codex || !server) return;

  const version = plugin.version;
  if (!version) {
    fail('.claude-plugin/plugin.json has no version — it is the source of truth');
  } else if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    fail(`.claude-plugin/plugin.json version "${version}" is not semver`);
  }

  const entry = (marketplace.plugins || []).find(p => p.name === PLUGIN_NAME);
  if (!entry) {
    fail(`.claude-plugin/marketplace.json has no "${PLUGIN_NAME}" entry`);
  }
  const agentsEntry = (agents.plugins || []).find(p => p.name === PLUGIN_NAME);
  if (!agentsEntry) {
    fail(`.agents/plugins/marketplace.json has no "${PLUGIN_NAME}" entry`);
  }

  if (plugin.name !== PLUGIN_NAME) {
    fail(`.claude-plugin/plugin.json name is "${plugin.name}", expected "${PLUGIN_NAME}"`);
  }
  if (codex.name !== PLUGIN_NAME) {
    fail(`.codex-plugin/plugin.json name is "${codex.name}", expected "${PLUGIN_NAME}"`);
  }

  // Versions must agree, or users see different numbers depending on the store they installed from.
  const versions = {
    '.claude-plugin/plugin.json': version,
    '.claude-plugin/marketplace.json': entry && entry.version,
    '.agents/plugins/marketplace.json': agentsEntry && agentsEntry.version,
    '.codex-plugin/plugin.json': codex.version,
    'server.json': server.version,
  };
  for (const [file, v] of Object.entries(versions)) {
    if (v !== version) {
      fail(`${file} is at ${v ?? 'unset'}, expected ${version} — run: node scripts/set-version.js ${version}`);
    }
  }
  if (version) note(`version    ${version} across ${Object.keys(versions).length} manifests`);

  // The description is the marketplace listing text in every store. Letting the copies drift
  // means users are told different things about the same plugin depending on where they found it,
  // and a capability claim can outlive the skill that backed it.
  const descriptions = {
    '.claude-plugin/plugin.json': plugin.description,
    '.claude-plugin/marketplace.json': entry && entry.description,
    '.agents/plugins/marketplace.json': agentsEntry && agentsEntry.description,
    '.codex-plugin/plugin.json': codex.description,
  };
  for (const [file, d] of Object.entries(descriptions)) {
    if (d !== plugin.description) {
      fail(`${file} description differs from .claude-plugin/plugin.json — keep them identical`);
    }
  }

  // Codex takes a directory pointer; a stale path silently ships zero skills.
  if (codex.skills && codex.skills !== './skills/') {
    fail(`.codex-plugin/plugin.json skills should be "./skills/", found "${codex.skills}"`);
  }

  if (!Array.isArray(server.remotes) || server.remotes.length === 0) {
    fail('server.json has no remotes[] entry');
  }

  // Asset paths in the Codex interface block are relative to the plugin root. A missing file
  // shows up as a broken image in the store listing rather than as an install error, so it is
  // easy to ship and hard to notice.
  const iface = codex.interface || {};
  for (const key of ['composerIcon', 'logo']) {
    const rel = iface[key];
    if (!rel) continue;
    const abs = path.join(ROOT, rel.replace(/^\.\//, ''));
    if (!fs.existsSync(abs)) {
      fail(`.codex-plugin/plugin.json ${key} points at "${rel}", which does not exist`);
    } else {
      note(`asset      ${key} -> ${rel}`);
    }
  }

  note(`skills     ${skillDirs.length} shipping: ${skillDirs.join(', ')}`);
}

// ---------------------------------------------------------------- required files

/** This repo is public. Fail loudly on anything that looks like a key, wherever it came from. */
function validateNoKeyMaterial() {
  const suspects = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(d => d.isFile())
    .map(d => d.name)
    .filter(n => /\.(pem|key|p12|pfx)$/i.test(n) || n === 'mcp-registry-auth');

  for (const name of suspects) {
    fail(`${name} looks like publishing key material — delete it or move it outside the repo`);
  }

  for (const file of ['.mcp.json', 'server.json']) {
    const abs = path.join(ROOT, file);
    if (!fs.existsSync(abs)) continue;
    if (/BEGIN [A-Z ]*PRIVATE KEY/.test(fs.readFileSync(abs, 'utf8'))) {
      fail(`${file} contains a private key block`);
    }
  }
}

function validateRequiredFiles() {
  for (const f of ['LICENSE', 'README.md']) {
    if (!fs.existsSync(path.join(ROOT, f))) fail(`${f} is missing`);
  }
  // The plugin directory rejects closed-source submissions, and an unlicensed public repo
  // is legally ambiguous no matter what the README claims.
  const license = path.join(ROOT, 'LICENSE');
  if (fs.existsSync(license) && !/MIT License/i.test(fs.readFileSync(license, 'utf8'))) {
    fail('LICENSE does not look like the MIT licence declared elsewhere');
  }
}

// ---------------------------------------------------------------- main

const skillDirs = validateSkills();
validateMcp();
validateManifests(skillDirs);
validateRequiredFiles();
validateNoKeyMaterial();

for (const n of notes) console.log(`  ${n}`);

if (errors.length) {
  console.error(`\n${errors.length} problem${errors.length === 1 ? '' : 's'}:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log('\nOK — safe to publish.');
