---
name: 3doptix-workflow
description: "Use this skill for any 3DOptix MCP work or 3DOptix optical setup, design, or simulation task. Triggers include: creating or modifying setups, configuring optics, light sources, or detectors, running or analyzing simulations, optimizing layouts, computing optical parameters, building catalog components, importing CAD/STEP files, browsing optomechanics (mounts, cages, posts, rails), uploading .opt setup files, working from starter templates, rendering analysis images, and troubleshooting beam paths or ray collection."
---

# 3DOptix MCP — Workflow Guide

---

## 🚨 Critical Safety Rules

These apply to **every** 3DOptix session without exception.

- Never call `3doptix_simulation_run` or `3doptix_analysis_run` without explicit user confirmation.
- Never silently skip a failed step or constraint violation.
- Never silently resolve a spec contradiction — always surface it and ask the user.
- Check for physical collisions analytically before every positional move.

---

## 1. Role & Scope

Goal: a **working prototype** — not a final optimized design. Move efficiently, make autonomous engineering decisions where the answer is clear, and stop to ask the user only when genuinely necessary.

**Covers:** Paraxial to moderate-aperture linear optics, including polarization systems. Simple and semi-complex designs.

---

## 2. Working Style

**Ask the user when:**
- System purpose, wavelength, or scale is missing or ambiguous.
- Multiple valid design directions exist with real trade-offs.
- A required spec is missing and cannot be reasonably assumed.
- An approximation was made that materially affects the outcome.

**Do NOT ask the user when:**
- A reasonable default exists (e.g., N-BK7 glass, 550 nm visible light).
- The answer follows directly from optical engineering principles.
- A catalog search returns a close enough match for a prototype.

When using an approximation or substitute component, briefly state: what you chose, what the target was, and the key difference. Continue unless the difference is significant.

---

## 3. Session Start

At the start of every session, display this step checklist:

```
[ ] Step 1 — Understand the System
[ ] Step 2 — Propose Optical Layout
[ ] Step 3 — Create Setup + Name + Widget Link
[ ] Step 4 — Build Each Optical Element
[ ] Step 5 — Place Light Source(s)
[ ] Step 6 — Place Detector(s)
[ ] Step 7 — Run Ray Tracing (with user approval)
[ ] Step 8 — Present Results
```

Mark the current step at each transition. Execute steps in order.

---

## 4. Workflow Gates — When to Wait for User

| Moment | Wait for user approval? |
|--------|------------------------|
| After layout proposal (Step 2) | **YES** |
| After each step transition | **YES** — brief preview of next step, then wait |
| Before simulation run (Step 7) | **YES** — explicit confirmation required |
| After 2 failed fix attempts | **YES** — summarize, ask for direction |
| After each individual component placement | **NO** — run internal checks; continue (widget auto-updates) |

---

## 5. Feasibility & Contradiction Check (before any design work)

Run all checks before searching for components or building a setup. Never silently resolve a contradiction — always surface it and ask the user.

1. **Source size vs. collimation:** Compute expected divergence θ ≈ source_radius / f_collimator. Flag if it violates the collimation spec.
2. **Throughput budget:** Estimate total throughput from element count. AR-coated surface ~0.5% loss; uncoated ~3.5%; metallic mirror 85–95%. If budget is tight, flag and recommend alternatives before building.
3. **Aperture vs. beam size:** Verify CA ≥ 1.5× beam diameter at every element.
4. **Wavelength vs. material:** Verify material transparency at the design wavelength when material data is available. If transmission data is missing or ambiguous, flag the uncertainty instead of assuming suitability.
5. **Detector coverage:** Confirm detector size is at least 2× the expected beam footprint at the detector plane.
6. **Any other spec contradiction:** raise explicitly, resolve with user before proceeding.

---

## 6. Gaussian Beam Parameters & Lens Calculations

### 6.1 Gaussian Beam Parameters

Run these analytically before placing components. No tool calls needed. Flag only if the result conflicts with spec.

```
Gaussian beam radius:    w(z) = w0·√(1 + (λz / πw0²)²)
Rayleigh range:          z_R = πw0² / λ
Collimator EFL:          f = beam_radius_target / tan(θ_div)
Beam at lens:            verify w(z_lens) vs. CA rule (CA ≥ 1.5× beam diameter)
```

### 6.2 Custom Lens / Mirror / Grating Creation

Custom catalog parts are the exception — prefer existing catalog optics first (§18). When a custom part is genuinely needed, the design sequence is non-trivial: refractive-index lookup → radii from EFL → EFL verification → BFL/FFL → manufacturability check → creation. Hardcoded or eyeballed radii routinely miss the target EFL by 10–30 % because small radius errors integrate via the lens-maker equation; the user only sees the failure post-simulation.

> **Read `references/custom-catalog-components.md`** before any `3doptix_lens_create`, `3doptix_mirror_create`, `3doptix_grating_create`, `3doptix_aperture_create`, or `3doptix_multiplet_create` call. It contains the full lens geometry sub-routine (Steps A–C with tool signatures, BFL/detector-position formulas, manufacturability formulas), variant rules, mirror coating defaults, candidate Edmund mirror IDs, and the `optics_update` auto-clone behavior.

---

## 7. Standard Layout Convention

Apply to every 3DOptix setup.

### 7.1 Primary Design Plane
Build layouts in the **Z-X plane**. Set Y = 0 for every component unless a specific optical reason requires otherwise. State any Y ≠ 0 placement explicitly.

### 7.2 Origin & Centering
Keep the layout center at **(0, 0, 0)**. Distribute components around this origin; never offset the full layout to one corner.

### 7.3 Input Beam Direction
- Light source placed along the **−Z axis**, propagating in the **+Z direction**.
- Source pose: `[0, 0, −d, 0, 0, 0]` where d is a comfortable working distance (default: 50 mm).
- The first optical element is placed at or near z = 0.

### 7.4 Fold / Relay Direction
- After any fold element (mirror, prism, beam splitter), the beam continues along the **+X axis**.
- A 45° fold mirror in the Z-X plane uses **beta = -45°** (rotation around Y-axis) for a +Z to +X fold: pose `[x, 0, z, 0, -45, 0]`.
- All fold elements remain in the Z-X plane (Y = 0).

| Incoming beam | Desired output | Mirror beta | Back-CS offset direction | Notes |
|---|---:|---:|---|---|
| +Z | +X | −45° | (−x, 0, +z) | +Z beam hits front first ✅ |
| +Z | −X | +45° | (+x, 0, +z) | +Z beam hits front first ✅ |
| +X | +Z | +135° | (+x, 0, −z) | Use **+135°**, NOT +45° — see trap below |
| +X | −Z | −135° | (−x, 0, −z) | Use **−135°**, NOT −45° — see trap below |

**Rule:** For every fold *after the first*, the β that produces the correct reflection direction is NOT the same as for a +Z input beam. The mirror must be flipped 180° (add 180° to the naive β) so its front face meets the beam.

> ⚠️ **Second-fold orientation trap.** After any fold, the beam propagation axis changes (e.g., +Z → +X). A mirror placed in the new arm using the same β as the first fold will have its *back* surface facing the incoming beam — the simulation will appear misaligned or produce zero hits with no obvious error. A mirror's back CS is always displaced from the front in the direction of the front outward normal, so the same β that works for +Z silently fails for +X. **Always run the front-face entry check (§8.2) on every fold mirror from the 2nd onward.**

### 7.5 Multiple Folds

| Fold # | Beam direction after fold | Typical use |
|--------|--------------------------|-------------|
| 1st fold | +X | 90° relay turn, periscope arm 1 |
| 2nd fold | −Z or +Z | Return along Z axis (U-shape or Z-fold) |
| 3rd fold | −X | Compact folded path |
| 4th fold | +Z | Full loop, returns to input direction |

Always remain in the Z-X plane across all folds.

### 7.6 Detector Placement
- Positioned at the output end of the beam path, perpendicular to the local beam propagation axis.
- Rotated with the appropriate alpha/beta angle to face the incoming beam.

### 7.7 ⭐ Layout Approval Gate — Mandatory Before Any Component Placement

**STOP** after completing the design and **before calling any MCP placement tool.**

Present the proposed layout to the user as a top-down Z-X schematic or clear description, including:
- Component identities and approximate positions
- Beam propagation sequence and fold direction(s)
- A clear question: *"Does this layout look correct? Shall I proceed with placing the components?"*

**Do NOT call any MCP tool** (`3doptix_setup_add_optics`, `3doptix_light_source_create`, `3doptix_detector_create`, `3doptix_parts_configure`, etc.) until the user explicitly approves the layout.

---

## 8. Component Placement — Per-Element Checklist

For every component added, run the relevant checklist before moving to the next element.

Use `3doptix_parts_get_detailed` to verify pose/orientation when orientation matters, when a component was moved/rotated, or when the expected beam path is uncertain. Use the returned surfaces and coordinate-system data; do not hardcode a coordinate-system key such as `"front CS"` unless it appears in the returned data for that part.

### 8.0 Duplicate & Consistency Check — Run After Completing a Placement Series

After each placement group, call **`3doptix_parts_list`** on the setup and verify layout consistency.

**For large setups (>10 parts):** Run this check every 5–10 additions.

A potential duplicate is flagged if **any** of the following are true:
- A part with the same **label** already exists.
- A part of the same **type** appears unexpectedly (e.g., two detectors when only one was intended).
- Two parts occupy the same **z-position** (within ±1 mm).

`parts_list` type values: `OPTICS`, `LIGHT_SOURCE` (type 8), `DETECTOR` (type 9), `OPTOMECHANICS` (CAD parts). CAD parts do not interact with the beam — exclude them from optical layout checks.

If a duplicate is detected, stop and present the conflict (which label, which type, which existing part) and offer three options: delete the duplicate, keep both (e.g. intentional multi-pass / beam-splitter paths), or review the layout. Do not silently resolve — always get the user's decision.

### 8.0b Component Classification Gate

Before running an orientation checklist, classify the component using its actual part type/subtype from `3doptix_parts_get_detailed` when available. State the classification before proceeding.

| Component type / subtype | Classification | Checklist |
|---|---|---|
| Lens, window, filter, aperture | TRANSMISSIVE | 8.1 |
| Transmission grating | TRANSMISSIVE | 8.1 |
| Mirror | REFLECTIVE | 8.2 |
| Reflective, blazed, or echelle grating | REFLECTIVE | 8.2 |
| Detector | RECEIVER | 8.3 |
| Beam splitter or prism | MIXED | Treat as multi-surface; do not use the reflective checklist by default |
| `type: "OPTOMECHANICS"` (CAD part) | MECHANICAL | Skip optical checklists entirely — no surfaces, no beam interaction |

For MIXED elements, enumerate the relevant surfaces and expected output paths from the returned part data. If temporary detectors or a quick simulation are needed to verify the path, stop and ask for explicit user confirmation first.

### 8.1 Transmissive elements (lens, window, filter, aperture, transmission grating)
- When orientation matters or the part was rotated, verify the front/input surface with `3doptix_parts_get_detailed`; do not rely only on assumed pose angles.
- Surface normal should face the incoming beam according to the part's returned surface/CS data.
- CA ≥ 1.5× beam diameter at that position.
- Confirm material and geometry match spec or state the approximation.
- Verify position along optical axis is consistent with design layout table.
- To update an aperture's shape, dimensions, transmittance, or phase after creation, use `3doptix_aperture_configure`. Only provide the fields that need to change; all others are preserved. Call `3doptix_get_tool_guide("aperture_configure")` for the full parameter list.

### 8.2 Reflective elements (mirror, reflective grating)
- When orientation matters or the part was rotated, verify the front/reflective surface with `3doptix_parts_get_detailed`; do not rely only on assumed pose angles.
- Compute reflected beam direction: `r = d − 2(d·n̂)n̂` using actual rotation applied.
- State result numerically. Confirm it matches intended output direction.
- If mismatch: correct rotation sign, recompute, confirm before proceeding.
- CA ≥ 1.5× beam diameter at that position.
- Every mirror must have a reflective surface. For catalog mirrors, inspect with `3doptix_optics_get` to confirm. For coating defaults, candidate Edmund mirror IDs, and override rules, see `references/custom-catalog-components.md`.

**Front-face entry check — MANDATORY for any mirror whose incoming beam is not along +Z** (i.e., every fold mirror from the 2nd onward, and any mirror in a non-default beam arm):

1. Call `3doptix_parts_get_detailed` on the mirror and read both the front-surface CS position and the back-surface CS position.
2. Compare positions along the incoming beam's propagation axis:
   - Beam along +Z → require `back_CS.z > front_CS.z`
   - Beam along −Z → require `back_CS.z < front_CS.z`
   - Beam along +X → require `back_CS.x > front_CS.x`
   - Beam along −X → require `back_CS.x < front_CS.x`
3. If the inequality fails, the mirror is backwards (beam hits the back surface first). **Add 180° to β** (e.g., −45° → +135°, +45° → −135°) and re-verify with `parts_get_detailed`.
4. State the front/back coordinates and the comparison result numerically before moving on. Do not skip this even if the reflection direction appears correct — a backwards mirror can still produce a plausible-looking ray path while losing power at the wrong surface.

### 8.3 Detector
1. Use `3doptix_parts_get_detailed` when detector orientation needs verification. The default detector front normal points along **-Z** and faces an incoming +Z beam with no rotation.
2. Verify the front surface faces the incoming beam:
   - Beam along +Z: no rotation needed by default.
   - Beam along +X: beta = -90° required.
   - If mismatch: correct rotation with `3doptix_detector_configure`, then re-check.
3. Position at the expected focal or image plane.
4. Size appropriately for the beam (at least 2× expected spot diameter).

### 8.3b Mixed elements (beam splitter, prism)
- Use `3doptix_parts_get_detailed` to enumerate available surfaces and identify intended input/output faces.
- Do not treat the part as a simple mirror by default.
- Check expected transmitted, reflected, or deviated output paths from the part subtype and returned geometry.
- If verification requires temporary detectors or `3doptix_simulation_run`, ask for explicit user approval first and clean up temporary parts afterward.

### 8.4 After every component placement
- All checks passed → continue to next component.
- Any check fails → fix before proceeding.
- Prefer catalog components over custom-created ones. If no catalog match: note approximation briefly, continue.
- Don't regenerate the widget URL after each placement — the URL is deterministic per setup and the iframe auto-refreshes, so a fresh URL adds noise without giving the user new information (see §11).

### 8.5 Pre-Simulation Audit — Run Once Before Step 7

Before requesting simulation approval, call `3doptix_parts_list` on the complete setup and verify the layout matches the approved design:
- Correct number of each component type (optics, sources, detectors).
- No unintended duplicate labels or overlapping z-positions (±1 mm).
- All components present from the approved layout proposal.

**If issues found — STOP.** Present the discrepancy and resolve with user before proceeding.
**If clean:** Print `✅ Layout audit passed.` and proceed to simulation approval.

---

## 9. Collision Checking

Before any `3doptix_parts_configure` call, compute the gap between the part you're moving and its neighbors:

```
gap(A→B) = front_surface_B_position − back_surface_A_position
```

- Use `3doptix_parts_get_detailed` for front/back CS positions. If thickness is not returned, assume 5 mm as a safe default.
- If `gap ≤ 1 mm` (or the user's stated minimum): **BLOCK** the move, propose the nearest safe value, and ask for confirmation.
- Update the gap map mentally after every move — do not wait for simulation feedback.

---

## 10. Pose Convention

All position/tilt is specified as `pose: [x, y, z, alpha, beta, gamma]`
- `[0–2]` = position in mm (or inches if setup uses imperial units)
- `[3–5]` = tilt in degrees (Euler: alpha=Rx, beta=Ry, gamma=Rz)

Use `3doptix_parts_get_detailed` to read the current pose before making changes. The response includes `lcs` (local coordinate system) with front/back surface positions — essential for collision checking.

---

## 11. Widget URL Rules

Use `3doptix_setup_get_widget_url` as the primary visual-inspection link. The widget URL is deterministic and auto-updates as components are added, moved, or configured.

Generate it once in the first reply after the setup is created or identified. Present it with:
> *"Here is your live 3D widget — keep this open on the side. It will auto-update as I build and modify the setup."*

- Do not regenerate after every placement, move, or simulation.
- If the user asks to "show" the setup, re-share the existing URL instead of calling the tool again.
- Regenerate only if the user explicitly asks, the previous URL fails, or the session switches to a different setup.
- For setups not created in this session, first call `3doptix_setup_get` and inspect `isShareable`. If false, ask before calling `3doptix_setup_change_shareability(setupId, isShareable: true)`. If true, proceed with `3doptix_setup_get_widget_url`.

---

## 12. Setup Naming

Use `[SystemDescription]_YYYY-MM-DD_HH-MM`, e.g. `BeamExpander_5x_550nm_2026-03-25_14-30`. Before creation, call `3doptix_setup_list`; if the name exists, append `_v2` or increment and inform the user.

---

## 13. Source Type Rules

> **Source and optical calculations:** Read `references/source-and-optical-calculations.md` before choosing/configuring a source type, setting source-specific parameters, collimating a diverging source, modeling fiber/LED/extended emitters, or doing EFL/refractive-index/beam-expander calculations.

---

## 14. Step-by-Step Execution

### Step 1 — Understand the System
If enough info is provided, summarize in 2–3 sentences and proceed. If critical info is missing, ask in a short numbered list (only what you actually need). Run feasibility checks (§5) before proposing anything.

### Step 2 — Propose Optical Layout
Propose a numbered list of optical building blocks with one-line descriptions. Use engineering judgment; do not ask unnecessary questions. Present the proposed layout as a top-down Z-X schematic including component positions, beam path, and fold directions. **Wait for explicit user confirmation before proceeding** (Layout Approval Gate — §7.7).

### Step 3 — Create Setup + Widget
Create the 3DOptix setup with a name following the naming rule (§12). Call `3doptix_setup_list` first to check for name conflicts. Generate and share the widget URL immediately after creation — tell the user to keep it open on the side as it auto-updates (§11).

### Step 4 — Build Each Optical Element
Build elements one at a time in optical-path order. For each element: classify it (§8.0b), select/create the component, verify geometry and material, then run the matching checklist. If no exact catalog match exists, pick the closest safe match, state the approximation, and continue. Run the consistency check after all optics placements, or every 5–10 parts for large setups.

### Step 5 — Place Light Source(s)
Apply source type rules (§13). Place source. Ask only if source parameters were not specified and cannot be reasonably assumed.

### Step 6 — Place Detector(s)
Position at expected focal/image plane. Size at least 2× expected beam diameter (§8.3).

### Step 7 — Run Ray Tracing
Run the **Pre-Simulation Audit** (§8.5). Only after the audit passes (or the user explicitly resolves all conflicts) may you proceed. Provide a one-paragraph summary of the complete setup. Remind user of the widget URL for final layout review. Ask explicitly: *"Ready to run the ray tracing simulation?"* Do not call `3doptix_simulation_run` without explicit user confirmation.

### Step 8 — Present Results
Present: ray hit statistics, detector efficiency, significant ray losses, rendered irradiance or spot image. Remind user of widget URL to inspect results visually. Flag any design issues and suggest next iteration if needed. Then offer applicable analyses (§16).

---

## 15. Iteration Limit

When fixing a failing spec, broken placement, simulation error, or any repeated failure:
- After **2 failed attempts** at the same problem — **STOP.**
- Present: what was tried, what failed, root cause hypothesis and ask the user for direction.

---

## 16. Analysis Offer & Available Analyses

> **Analysis workflow:** Read `references/analysis-workflow.md` after each `3doptix_simulation_run` and before presenting analysis choices or calling `3doptix_analysis_run`. The reference contains applicability criteria, exact `meta.name` strings, default `meta.type`/`meta.numRays`/`meta.resolution` values, chat presentation rules, and the `3doptix_analysis_run` usage gate.

Never run any analysis tool automatically. Analyses are billable user-facing artifacts — running one without explicit selection wastes the user's quota and may produce results they don't want. After each simulation, evaluate applicable analyses, present only valid options, and wait for user selection or explicit approval.

---

## 17. Optimization Sessions

When the user wants to iteratively optimize a layout, load the detailed protocol:

> **Read `references/optimization-workflow.md`** for the full phase-by-phase protocol (intake → baseline → iterations → final summary).

Key constraints that always apply even outside formal optimization:
- Never change two variables simultaneously without explicit user instruction.
- If flux drops below the user's stated floor after any move → **REVERT IMMEDIATELY**.
- Flag stalls after 2 iterations with no improvement on the same variable.

---

## 18. Catalog Search & Custom Catalog Components

Before creating a custom catalog component, search the catalog first. If the component type is known, use the type-specific search tool: `3doptix_search_lens`, `3doptix_search_mirror`, `3doptix_search_filter`, `3doptix_search_prism`, `3doptix_search_grating`, `3doptix_search_beam_splitter`, `3doptix_search_aperture`, or `3doptix_search_window`. Use `3doptix_search_all_types` only when the component type is unknown or ambiguous.

For **optomechanics** (mounts, cages, posts, rails, etc.) use the optomechanics tools — not the optics search tools. See §26.

Use `query` to search for exact model/catalog text. Use `model_pattern` only to narrow the returned results; it is a client-side post-filter and can miss a model that was not returned by the backend search. If you know the exact 3DOptix catalog `number_id`, use `3doptix_optics_get` directly before adding the part.

> **Custom catalog components:** Read `references/custom-catalog-components.md` before creating a catalog component that doesn't already exist with `3doptix_lens_create`, `3doptix_mirror_create`, `3doptix_aperture_create`, `3doptix_grating_create`, `3doptix_multiplet_create`, or the follow-up `3doptix_setup_add_optics` call.

> ⚠️ **`number_id` vs `id`:** Search tools and creation tools both return two ID fields — `id` (Elasticsearch document ID, internal use only) and `number_id` (the catalog component ID). The `3doptix_setup_add_optics` parameter is called **`componentNumberId`** — always pass the `number_id` value into it. Passing `id` will fail or place the wrong component.

> ⚠️ **`materialId` format:** Always use the `number_id` returned by `3doptix_material_search_by_name` as the `materialId` in creation tools — it is lowercase with a vendor suffix (e.g., `"n-bk7_schott"`), not the display name (`"N-BK7"`). Passing a display name will fail or use the wrong material.

> ⚠️ **`3doptix_optics_update` on public optics:** Updating a public catalog optic causes the backend to auto-clone it as a new private entry with a different `number_id`. The response includes `cloned: true` and the new `number_id`. If the original optic was already in a setup, call `3doptix_setup_add_optics` with the new `number_id` to replace it — the setup still references the old public ID.

---

## 19. Starting from an Existing Zemax File

> **Zemax import:** Read `references/zemax-import.md` when the user uploads a Zemax file or asks to extract/import a Zemax design. It defines support for `.ZMX`, `.ZMF`, and `.ZOS`, plus the extraction-to-layout handoff.

---

## 20. Error Handling

- Explain what happened in plain language.
- Propose a specific fix.
- Never silently skip failed steps or substitute without telling the user.
- If an MCP tool cannot accomplish a required operation: explain the gap, suggest an alternative (manual calc, Python script, or user input), and ask how to proceed.
- If a simulation or analysis job is stuck, taking too long, or queued incorrectly, ask before calling `3doptix_simulation_queue_clear` unless the user already asked to cancel/clear it.
- For suspected server availability issues, use `3doptix_api_healthcheck`; for API key/auth/session issues, use `3doptix_client_status`.

---

## 21. Known Limitations

| Limitation | Guidance |
|------------|---------|
| No surface shape variables (radii, conic) via MCP | After 5+ position/tilt iterations with no improvement, recommend Zemax/OpticStudio |
| No parameter sweep or merit function | Manual single-variable iteration only |
| Analytical model is paraxial | For fast/wide-angle systems, predictions may drift >20% — use smaller steps |
| Ray count < 1000 → unreliable statistics | Flag before reporting statistical metrics |
| Physical dimensions may be missing | Use `3doptix_parts_get_detailed`. If thickness absent, assume 5 mm |

---

## 22. In-Memory Ray Table

After every `3doptix_simulation_analyze` call, store `surfaceHits` and `detectorPerformance` as a session-level ray table. Use it for ray, beam, and efficiency questions without extra tool calls. Replace it completely after every new simulation; never merge stale and fresh data.

> **Full protocol:** Read `references/ray-table.md` when the user asks for ray data, beam footprints, CSV export, or RMS radius calculations.

---

## 23. Session Context Management

Work from live API state, not conversation history, whenever the current setup state matters. Use `3doptix_setup_get`, `3doptix_parts_list`, and `3doptix_parts_get_detailed` to refresh setup and part state before making decisions. Re-summarize prior steps only when the user asks or when needed to explain a decision.

---

## 24. `3doptix_simulation_analyze` Format Selection

Default to `format: "summary"` for the first analysis pass after a simulation. The tool still returns a structured report, while the formatted output stays compact.

Use `format: "json"` when the user asks for ray table export, CSV download, RMS radius from hit positions, per-surface beam footprint breakdown, raw `surfaceHits`, or another operation that needs detailed structured data. Use `format: "console"` only when a full human-readable report is more useful than the compact summary.

State which format is being used when upgrading beyond summary.

---

## 25. Tool Guides — `3doptix_get_tool_guide`

Most tool descriptions end with `Call get_tool_guide('name') for ...` — that is your cue. The inline description is intentionally trimmed to save context; the full parameter list, valid values, examples, and error notes live in the guide.

Call `3doptix_get_tool_guide(tool_name)` whenever:
- The tool's own description tells you to.
- The tool has branching variants (e.g., `lens_create`, `mirror_create`, `grating_create`, `aperture_create`, `analysis_run`) — variant rules are not in the inline description.
- You hit a parameter validation error and the cause is not obvious from the message.

---

## 26. CAD / Optomechanics

### 26.1 Browse the Catalog

1. `3doptix_optomechanics_catalog_overview(type?)` — list all catalog categories, sections, and filter values. Pass the optional `type` parameter (e.g., `"Optics Mount"`, `"Cage Components"`) to scope results when the category is already known. Call first to learn valid `section`/`category`/`subcategory` values before searching.
2. `3doptix_search_optomechanics(search_title, query?, section?, category?, subcategory?, brands?, ...)` — search for mounts, cages, posts, rails, etc. Use `query` for free-text; use `section`, `category`, `subcategory`, `brands` for structured filters from the catalog overview. Call `3doptix_get_tool_guide("search_optomechanics")` for the full filter reference.
3. `3doptix_optomechanics_get(numberId)` — fetch a single part by exact `number_id` (e.g., `"thr_km100"`).
4. `3doptix_setup_add_optomechanics(setupIdentifier, componentNumberId, label?, pose?)` — add the part to a setup. Accepts optional `label` and `pose` at insertion time.

> ⚠️ Always pass `number_id` (not `id`) to `setup_add_optomechanics`. Passing `id` will fail or place the wrong component.

> ⚠️ **Auto-rollback on failure:** If `setup_add_optomechanics` fails during label/pose configuration after the part was already inserted, it automatically deletes the part and throws. Do not attempt manual cleanup — the part is already gone.

### 26.2 Upload a Custom STEP/STP File

> **File upload:** Read `references/file-upload.md` for the full upload workflow, polling rules, and error handling. The STEP → CAD flow is: `request_file_upload` → user uploads → poll `get_upload_status` → `cad_upload_and_process` → `setup_add_optomechanics`.

---

## 27. Setup Templates & Import from File

### 27.1 Create from Starter Template

1. `3doptix_setup_list_starter_templates` — list available pre-configured templates (returns IDs, names, descriptions). Offer this to user when the task missing specifics. This allows user to get a complete preconfigured setup as a starting point for experimenting. Always offer starter templates when user asks what you can do.
2. `3doptix_setup_create_from_template(templateId)` — create a new setup from the chosen template. Returns `id`, `name`, and a widget URL.

Call `3doptix_get_tool_guide("setup_create_from_template")` for full details.

### 27.2 Import a `.opt` File

> **File upload:** Read `references/file-upload.md` for the full upload workflow. The `.opt` import flow is: `request_file_upload(category:"setup")` → user uploads → poll `get_upload_status` → `setup_create_from_file(s3Url, setupName?, unit?)`.

---

## 28. Quick Reference: Defaults & Constants

| Parameter | Default / Rule |
|-----------|---------------|
| Lens material (generic) | N-BK7 |
| Wavelength (visible, unspecified) | 550 nm |
| Emitter size (unspecified) | Ø0.1 mm (half-width 0.05 mm) |
| Clear aperture margin | CA ≥ 1.5× beam diameter |
| Detector size | ≥ 2× expected spot diameter |
| AR-coated surface loss | ~0.5% per surface |
| Uncoated surface loss | ~3.5% per surface at normal incidence |
| Metallic mirror reflectance | 85–95% |
| Mirror surface | Catalog/custom mirrors must have a reflective surface; custom `3doptix_mirror_create` defaults to `ideal_reflector` |
| Source-to-collimator distance | Must equal selected EFL |
| Setup name format | `[Desc]_YYYY-MM-DD_HH-MM` |
| Valid source types | `PLANE_WAVE` (default), `GAUSSIAN_BEAM`, `POINT_SOURCE`, `LED`, `RAY_FILE` |
| Design plane | Z-X (Y = 0); input beam +Z (source at −Z); post-fold +X; 1st fold mirror β = −45°. Subsequent folds: see §7.4 table (β shifts by 180° when input is +X/−X — run §8.2 front-face check) |
| Collision floor | 1 mm minimum gap between elements |
| `materialId` format | `number_id` from `material_search_by_name` (e.g. `"n-bk7_schott"`), never the display name |
| Transmission grating | `blazeAngle` (rad) + `blazeWavelength` (nm) required for `variant: "transmission"` |
| Optomechanics flow | `optomechanics_catalog_overview(type?)` → `search_optomechanics` → `setup_add_optomechanics` |
| File upload flows | See `references/file-upload.md` (CAD STEP, .opt import, ray file) |
| Template flow | `setup_list_starter_templates` → `setup_create_from_template(templateId)` |
| Available FAST analysis | `"Spot (Incoherent Irradiance)"` only (other FAST types blocked server-side) |
| Available ADVANCED analyses | 15 types — see `references/analysis-workflow.md` |
