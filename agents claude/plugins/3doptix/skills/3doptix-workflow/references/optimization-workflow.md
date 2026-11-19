# 3DOptix MCP — Optimization Workflow

Detailed phase-by-phase protocol for iteratively optimizing optical layouts via MCP.

> **Context:** 3DOptix MCP has no built-in optimizer — no merit function, no variable sweep, no gradient solver. Optimization here means structured manual iteration: one variable at a time, with analytical verification and user approval at every step. The value of this protocol is that it keeps the user informed, prevents wasted simulation runs on physically invalid configurations, and creates a clear record of what was tried.

---

## Session Checklist

Track phase transitions explicitly. Display this at the start of every optimization session and update it as you progress.

```
SESSION CHECKLIST — [Setup Name]
[ ] Phase 0 — Intake:    system type, FOMs, free variables, constraints
[ ] Phase 1 — Baseline:  layout read → collision map → analytical pre-check → simulate
[ ] Phase N — Iterate:   analytical verify → user approves → apply → simulate (repeat)
[ ] Phase F — Summary:   before/after comparison, widget URL, layout lock
```

---

## Phase 0 — Design Intake

The goal here is to agree on exactly what you're optimizing, what you're allowed to change, and what the hard limits are — before touching anything. This avoids wasted iterations.

Ask related questions together, but don't overwhelm the user with a wall of text. Group by topic: first get the setup and system type, then FOMs, then variables, then constraints. Wait for each group's answers before moving to the next.

### 0.1 — Setup & System Type

Confirm:
- Setup name (must match `3doptix_setup_list` exactly)
- System type: imaging / collimation / beam delivery / illumination / LiDAR / other
- Design wavelength(s) (e.g. 532 nm, 1064 nm, broadband 400–700 nm)

### 0.2 — Figures of Merit (FOMs)

Ask the user to rank their primary optimization targets. Present as a numbered list so they can reply with numbers in priority order (e.g. "1, 3"):

1. Min spot size (RMS radius)
2. Min angular divergence
3. Max flux / throughput
4. Beam pointing accuracy (centroid X/Y)
5. Irradiance uniformity
6. Encircled energy
7. Peak irradiance
8. Min dark-zone irradiance
9. Zonal flux ratio
10. Focus plane position
11. Other (ask them to describe)

### 0.3 — Free Variables

For each component that may be adjusted, ask:
- Component name (as it appears in `3doptix_parts_list`)
- Allowed degrees of freedom: X / Y / Z / alpha / beta / gamma
- Min–max range for each DOF
- Initial step size

Example format to suggest: `Lens 2 — Z only, 40–65 mm, step 2 mm`

DOF → MCP mapping:
| DOF | pose index | tool |
|-----|-----------|------|
| X, Y, Z (mm) | pose[0], pose[1], pose[2] | `3doptix_parts_configure` |
| alpha, beta, gamma (deg) | pose[3], pose[4], pose[5] | `3doptix_parts_configure` |
| Detector size/position | — | `3doptix_detector_configure` |
| Source wavelength/divergence | — | `3doptix_light_source_configure` |

### 0.4 — Constraints

Ask each category — the user can answer "N/A" to skip:

**Geometry:**
- Max total system length (source → detector)?
- Min element separation (collision floor)? [default: 1 mm]
- Housing envelope (X/Y/Z bounding box)?
- Max lateral offset from optical axis?

**Performance:**
- Min acceptable flux at detector (% of source)?
- Max acceptable RMS spot radius?
- Max allowed centroid offset?
- Min ray count for valid statistics? [default: 1000]
- Peak irradiance damage threshold (W/cm²)?

**Fixed elements:** Which components must NOT be moved?

**Fixed pairs:** Are any component pairs required to maintain a fixed relative distance?

### 0.5 — Plan Approval

Summarize all inputs in this table. Do not proceed to Phase 1 until the user explicitly approves. If they change anything, regenerate and resubmit.

```
OPTIMIZATION PLAN — [Setup Name]
System: [type] | Wavelength(s): [λ]

Variable         | Current | Min   | Max   | Step
─────────────────────────────────────────────────
[component DOF]  | [val]   | [min] | [max] | [step]
─────────────────────────────────────────────────
FOMs (ranked):    [P1], [P2], ...
Flux floor:       [X]% | Min rays: [N]
Collision floor:  [X] mm
Fixed parts:      [list]
Fixed pairs:      [list]
─────────────────────────────────────────────────
Approved? (yes / modify / cancel)
```

---

## Phase 1 — Baseline Measurement

### Step 1 — Read Layout

Call `3doptix_parts_list`, then `3doptix_parts_get_detailed` on every component.

Record for each part:
- Label, type, part ID
- Position [x, y, z] and tilt [alpha, beta, gamma]
- Physical dimensions (diameter, front/back surface CS positions)

Present a layout inventory table to the user.

### Step 2 — Build Collision Map

From `3doptix_parts_get_detailed` surface data, compute the axial gap between every adjacent element pair:

```
gap(A→B) = front_surface_B_z − back_surface_A_z
```

- Flag any gap ≤ collision floor immediately — before simulating.
- If a collision already exists in the baseline: **STOP and report to the user.** Do not run the simulation on a physically invalid layout.
- Keep this map active throughout the session and update it analytically after every proposed move.

### Step 3 — Analytical Pre-Check

Before simulating, verify:
- Paraxial image plane: does the detector sit near the expected focus position?
- For collimation/beam delivery: compute expected output divergence from source parameters + collimator EFL.
- All hard constraints from the plan satisfied?

If any check fails: report the specific issue to the user and ask how to resolve it. Never simulate a layout that fails this check — it wastes a simulation run and produces misleading results.

### Step 4 — Run Baseline Simulation

- Call `3doptix_setup_get_widget_url` and share the link for visual confirmation.
- Ask: "Ready to run the baseline simulation?" — wait for confirmation.
- Call `3doptix_simulation_run` → on completion, call `3doptix_simulation_analyze`.
- Run applicable analyses (flux, spot size, focus plane, RMS, centroid) per the active FOMs from Phase 0.

### Step 5 — Present Baseline Results

```
Metric            | Analytical Est. | Simulated | Target  | Delta  | Status
──────────────────────────────────────────────────────────────────────────
Flux on detector  | ~74%            | 71%       | ≥ 80%   | −9%    | FAIL
RMS spot radius   | ~35 µm          | 38 µm     | ≤ 15 µm | +23 µm | FAIL
System length     | 248 mm          | —         | ≤ 300   | —      | PASS
Min element gap   | 4.2 mm          | —         | ≥ 2 mm  | —      | PASS
```

Propose the first metric to tackle (use NSC Priority Tier Order below). Wait for user approval before starting iterations.

---

## Phase N — Optimization Iterations

Each iteration follows this fixed 8-step sequence. No step may be skipped.

### Step A — Propose the Change

State clearly:
- Which component
- Which DOF
- Current value → proposed value
- Analytical justification (why does this change improve the target metric?)
- Quick constraint check (is the new value within bounds? does it pass the collision floor at a glance?)

Example: *"Move Lens 2 Z: 50 → 52 mm. Paraxial estimate: shifts image plane ~1.8 mm closer to detector. Gap to Lens 1 back surface ≈ 12 mm — well above 2 mm floor. System length unchanged."*

**→ Wait for user confirmation before proceeding.**

### Step B — Analytical Verification

Run all four checks before any MCP tool call. This is what prevents wasted simulations on physically broken configurations.

**1. Collision check** — for every adjacent pair affected by the proposed move:
```
gap(A→B) = proposed_front_B_position − back_A_position
```
If `gap ≤ collision floor` → **BLOCK**. Propose the nearest safe value. Ask for confirmation.

**2. Bounds check** — is the new value within the allowed range from Phase 0?
If out of bounds → **BLOCK**. Propose the nearest valid value.

**3. Optical axis check** — for tilt changes, compute the new reflected/refracted beam direction. Verify the beam still reaches downstream apertures. If beam walk-off is detected → flag it before applying.

**4. Paraxial performance estimate** — predict the new metric value analytically. Apply the formula relevant to the component type:

| Scenario | Formula |
|---------|---------|
| Lens position change (imaging) | `1/f = 1/d_o + 1/d_i` |
| Gaussian beam propagation | `w(z) = w₀ √(1 + (λz / πw₀²)²)` |
| Collimating lens EFL | `f ≈ beam_radius / tan(θ_div)` |
| Mirror tilt change | `r⃗_reflected = d⃗ − 2(d⃗·n̂)n̂` |
| Flux through N surfaces | `T = Π(1 − loss_i)` — AR coating ~0.5%, uncoated ~3.5%, mirror 85–95% |
| Rayleigh range | `z_R = π w₀² / λ` |

Show the estimate to the user before simulation — it gives them confidence in the proposed move and helps calibrate trust in the analytical model over time.

**Do NOT call any MCP tool until all four checks pass.**

### Step C — Present Analytical Result & Request Approval

```
Proposed: [Component] [DOF]: [old] → [new]
Predicted metric: [current] → [estimate]  (target: [X])
Collision map: all gaps PASS
  — OR —
Collision map: ⚠️ gap [A→B] = X mm (floor: Y mm)
```

Ask: *"Analytical check passes — apply and simulate?"*
Or: *"Analytical check flagged a risk — proceed anyway, adjust value, or cancel?"*

**→ Wait for explicit confirmation before any MCP call.**

### Step D — Apply the Change

Call `3doptix_parts_configure`, `3doptix_detector_configure`, or `3doptix_light_source_configure` with the new values.

Record immediately:
- Component name
- Parameter changed
- Old value → new value
- Iteration number

### Step E — Update Widget

Call `3doptix_setup_get_widget_url`. Share the link so the user can visually verify the new layout before simulating. This catches obvious errors (component in wrong place, wrong axis) without spending a simulation run.

### Step F — Run Simulation

Ask: *"Ready to run simulation for iteration [N]?"* — wait for confirmation.

Call `3doptix_simulation_run`, then `3doptix_simulation_analyze` with analyses applicable to the active FOMs only. Don't run every analysis every time — it slows things down and clutters the results.

### Step G — Present Iteration Result

```
Metric | Previous | Predicted | Simulated | Delta | Target | Status
```

Also report:
- Collision map: all gaps PASS (or flag any new risks)
- Constraint check: PASS / FAIL
- Model accuracy: predicted vs. simulated ± X% (tracks how much to trust future predictions)
- Trend: improving → suggest continuing in same direction; stalling → see Phase 7

### Step H — Decision Point

Present options and wait for the user's choice:

1. Accept → continue in same direction (next value)
2. Accept → switch to next variable or metric
3. Try a different value for the same variable (finer/coarser step)
4. Revert → try a completely different variable
5. Stop → proceed to Phase F (Final Summary)

**Never proceed autonomously.** The user must select at every decision point.

---

## NSC Priority Tier Order

When multiple metrics are failing, address them in this order. Never skip a failing lower-priority tier without flagging it explicitly to the user.

| Priority | Metric | When It Applies |
|---------|--------|----------------|
| P1 | Position & tilt bounds | Always — hard limits from Phase 0. Never violate. |
| P2 | Flux floor + ray count | Every iteration. Flux drop below floor → **REVERT IMMEDIATELY** |
| P3 | RMS spot / angular RMS | Focusing & collimation systems |
| P4 | Angular centroid X/Y | Beam pointing (LiDAR, rangefinders, FSO) |
| P5 | Centroid X/Y (spatial) | Spatial pointing (imaging, projectors, fiber arrays) |
| P6 | Uniformity (std dev) | Illumination systems |
| P7 | Peak / min irradiance | Safety-critical: laser damage thresholds, dark zones |
| P8 | Zone flux / ratio | Shaped distributions: batwing, road lighting, multi-zone |
| P9 | Encircled energy | LiDAR long-range, fiber coupling, precision beam quality |

**P2 applies at every iteration regardless of primary FOM.** If any move causes flux to drop below the stated floor, revert it immediately — even if the primary metric improved.

---

## Stall Detection & Recovery

| Condition | Action |
|-----------|--------|
| No improvement after 2 iterations on the same variable | Flag stall. Offer: (a) finer step, (b) coarser step, (c) switch variable |
| 2 failed attempts on the same constraint violation | STOP. Report root cause. Ask user for direction |
| Collision detected analytically | BLOCK. Propose the largest in-bounds value that clears the gap. User must confirm |
| Analytical prediction vs. simulation error > 20% | Flag model drift. Use smaller steps. Treat estimates as directional only |
| Constraint violated even while primary metric improves | REVERT. Hard limits are absolute. Propose alternative within bounds |
| All targets met | Stop. Proceed to Phase F |
| User says "stop", "done", "finish", "that's good enough" | Proceed immediately to Phase F |

---

## Phase F — Final Summary

```
OPTIMIZATION SUMMARY — [Setup Name]

Metric    | Baseline | Final | Target | Status
──────────────────────────────────────────────
[FOM 1]   | [val]    | [val] | [val]  | PASS/FAIL
[FOM 2]   | ...
──────────────────────────────────────────────
Changes made:
  [Component] [DOF]: [old] → [new]  (iteration N)
  ...

Total iterations: X  |  Simulation runs: X  |  Blocked collisions: X
Min element gap (final): X mm  |  All hard constraints: PASS / FAIL
```

- Share final `3doptix_setup_get_widget_url` link.
- Ask: *"Lock this layout, continue iterating on another variable, or export?"*
- If any metric is still failing: flag it explicitly and suggest next steps (different variable, surface shape optimization via Zemax/OpticStudio, etc.).

---

## When to Stop and Recommend External Tools

| Situation | Recommendation |
|-----------|---------------|
| > 20 iterations with marginal improvement | Suggest Zemax/OpticStudio for gradient-based optimization |
| Spot size limited by aberrations (not position) | Surface shape optimization needed — MCP can't change r1/r2 |
| System requires simultaneous multi-variable optimization | MCP is serial only; suggest dedicated optimizer |
| Diffractive or freeform surfaces needed | Outside MCP scope entirely |
