# 3DOptix for AI coding agents

Design, simulate and analyse optical systems from your coding agent, using the
[3DOptix](https://www.3doptix.com) cloud platform.

This repository is a **plugin** — it bundles the 3DOptix MCP server together with a skill that
teaches the agent how to use it well. Install it once and your agent can build optical setups,
place lenses and detectors, run GPU ray-trace simulations and advanced optical analysis.

Skills here follow the [Agent Skills](https://agentskills.io) open standard, so they work in
Claude Code, Codex, Cursor and other compliant clients.

---

## Install

### Claude Code

```bash
claude plugin marketplace add 3doptix/skills
claude plugin install 3doptix@3doptix
```

### Codex

```bash
codex plugin marketplace add 3doptix/skills
codex plugin add 3doptix@3doptix
```

### Just the MCP server

If you only want the tools and not the workflow guidance, the server is listed in the
[MCP Registry](https://registry.modelcontextprotocol.io) as `com.3doptix/optical-design`, or add
it directly:

```bash
claude mcp add --transport http 3doptix https://mcp.3doptix.com
```

## Connect your account

You need a 3DOptix account. New sign-ups at [3doptix.com](https://www.3doptix.com) get a fully
functional trial; continued use needs a subscription.

Authentication is OAuth 2.0 with dynamic client registration. **There is no API key to paste.**

- **Claude Code** — run `/mcp`, select **3doptix**, sign in via the browser.
- **Codex** — run `codex mcp login 3doptix`.

Then confirm it worked by asking your agent to list your setups. Your agent can also walk you
through this itself — the bundled `3doptix-setup` skill activates on connection errors. Full
troubleshooting: [`skills/3doptix-setup/SKILL.md`](skills/3doptix-setup/SKILL.md).

---

## What's included

| Skill | What it covers |
|---|---|
| [`3doptix-workflow`](skills/3doptix-workflow/SKILL.md) | Setup creation, component placement and alignment, light sources, detectors, catalog and custom optics, simulation, analysis, optimisation, Zemax import, CAD upload |
| [`3doptix-setup`](skills/3doptix-setup/SKILL.md) | Connecting and verifying the MCP server; activates on auth errors |

The `3doptix` MCP server provides tools for setups, parts, the optics and optomechanics catalogs,
simulation, analysis and rendering. Tool reference: [3doptix.com](https://www.3doptix.com).

### Try it

```
Build a 2-lens beam expander for a 5 mm 632 nm beam, 3× magnification,
then run a spot diagram on the output.
```

```
Import my Zemax file into 3DOptix and tell me where the aberrations are worst.
```

---

## Repository layout

```
.claude-plugin/     Claude Code plugin + marketplace manifests
.codex-plugin/      Codex plugin manifest
.agents/plugins/    Codex marketplace manifest
.mcp.json           The 3DOptix remote MCP server
server.json         MCP Registry entry
skills/             Agent Skills — shared by every store
assets/             Store icons (the spectral sphere from the 3DOptix mark)
scripts/            validate.js, set-version.js — plain Node, no dependencies
```

Skill content lives in exactly one place. Each store gets a small manifest pointing at the same
`skills/` tree — nothing is duplicated per client.

There is no build step. Skills are Markdown and manifests are JSON, so what you see here is
exactly what gets installed.

---

## Contributing

### Adding a skill

Create `skills/<name>/SKILL.md` with the required frontmatter:

```markdown
---
name: your-skill-name
description: "When this skill should and should not trigger."
---
```

`name` must match the directory name — every store enforces this. Put anything lazily loaded in
`skills/<name>/references/` and point at it from `SKILL.md`. Skills are discovered by directory,
so there is no manifest to register a new one in.

Only skills under `skills/` ship. A skill still in development belongs in an `inactive-skills/`
directory instead — no store scans it there, so it can live in the repository without reaching
users.

### Checks

```bash
node scripts/validate.js
```

No install step; it has no dependencies. It checks skill frontmatter against the Agent Skills
spec, confirms all four manifests agree on a version, and refuses to pass if `.mcp.json` ever
grows a credential. CI runs the same script on every push and pull request.

Before publishing a change, also confirm what a user will actually receive:

```bash
claude plugin details 3doptix
```

### Releasing

`.claude-plugin/plugin.json` holds the authoritative version. To cut a release:

```bash
node scripts/set-version.js 1.1.0   # writes all four manifests
node scripts/validate.js
git commit -am "release: 1.1.0" && git tag v1.1.0
git push && git push --tags
```

**Never edit a manifest's `version` by hand** — `validate.js` will fail, which is the point.

Directories that list this plugin track commits on `main` and pick up changes automatically, so
a push is a release whether or not you tag it. Tag anyway; it is how users pin a known-good
version.

---

## Support

- Product and accounts — [support@3doptix.com](mailto:support@3doptix.com)
- Bugs in these skills — open an issue on this repository
- Privacy — [privacy policy](https://www.3doptix.com/privacy-policy)

## Licence

MIT — see [LICENSE](LICENSE).
