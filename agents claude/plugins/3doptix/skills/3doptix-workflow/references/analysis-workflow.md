# 3DOptix MCP — Analysis Workflow

Read this reference after each `3doptix_simulation_run` and before presenting analysis choices or calling `3doptix_analysis_run`.

## Analysis Offer — Trigger & Rules

Never run any analysis tool automatically. After each `3doptix_simulation_run`, evaluate applicable analyses, present only valid options, and wait for user selection or explicit approval.

**Applicability Criteria — offer an analysis only if ALL conditions are met:**

| Criterion | Rule |
|-----------|------|
| Design type | MTF, PSF, wavefront → imaging systems only. Spot size, OPD, ray aberrations → most systems. Focus plane distance → converging beam systems only. |
| Design maturity | Do not offer aberration, wavefront, or MTF analyses until the system produces a geometrically correct, reasonably focused beam at the detector. |
| Source coherence | Coherent analyses → only when source is coherent or partially coherent. Never offer for incoherent sources. |
| Spectral analysis | Offer `"Spectral Collection Analysis"` only when the source has multiple visible wavelengths or the user asks for spectral/color collection. |
| Ray count | Do not report statistical metrics if ray count < 1000; flag low-confidence statistics first. |
| Analysis resolution | For FAST (`"Spot (Incoherent Irradiance)"` with `meta.type: 0`), keep `meta.resolution.x <= 100` and `meta.resolution.y <= 100`; use ADVANCED (`meta.type: 1`) for high-resolution runs. For the workflow's default Advanced Incoherent preset, explicitly pass `meta.resolution: { x: 300, y: 300 }`. |
| Simulation quality | Do not offer any analysis if ray collection at detector is below 50%. Flag the geometry issue first. |

## Offer Format

Analysis selection guide:
- Coherent source + phase/wavefront need → `"Coherent Phase"`.
- Coherent source + irradiance/fringes need → `"Spot (Coherent Irradiance)"`.
- Incoherent source + irradiance/spot map → `"Spot (Incoherent Irradiance)"`.
- Multi-wavelength visible/RGB source → `"Spectral Collection Analysis"`.
- Beam size/focus questions → use Ray CSV / `3doptix_simulation_analyze` data first, not `3doptix_analysis_run`.

```
════════════════════════════════════════════
Analyses available for your system at this stage:
1. Spot size on sensor plane -> Ray CSV / `3doptix_simulation_analyze`
2. Focus plane distance -> Ray CSV / `3doptix_simulation_analyze`
3. Spot diagram (irradiance map) -> `"Spot (Incoherent Irradiance)"` or `"Spot (Coherent Irradiance)"`
4. Wavefront / phase error -> `"Coherent Phase"` (coherent sources only)

Select by number, list multiple (e.g. '1 3'),
or type 'all' to run all applicable analyses.
════════════════════════════════════════════
```

After presenting results, ask: *"Would you like to iterate, run additional analyses, or move to a different step?"*

**Never offer:** analyses failing any applicability criterion, analyses not listed in this reference, or multiple heavy analyses (MTF, PSF) simultaneously without warning they may take 30–60 seconds each.

## Available Analyses & Chat Presentation

Use `3doptix_analysis_run` for MCP analysis-image rows only. Ray CSV rows use `3doptix_simulation_analyze` instead. **Note:** `3doptix_analysis_run` is a combined tool — it configures an analysis type on a surface **and** immediately runs the ray tracing simulation in a single operation. It is not just an analysis configuration step. Present results as described immediately after each analysis completes.

Use exact MCP analysis names in `meta.name`. Only prod-available types are accepted — others return an error:
- FAST: `"Spot (Incoherent Irradiance)"` (the only FAST type available).
- ADVANCED (15 types): `"Spot (Incoherent Irradiance)"`, `"Spot (Coherent Irradiance)"`, `"Coherent Phase"`, `"Spot (Coherent Irradiance) Huygens"`, `"Coherent Phase Huygens"`, `"Spot (Coherent Irradiance) Fresnel"`, `"Coherent Phase Fresnel"`, `"Spot (Coherent Irradiance) Polarized"`, `"Coherent Phase Polarized"`, `"Spot (Incoherent Irradiance) Polarized"`, `"Fresnel PSF"`, `"Huygens PSF"`, `"Fresnel MTF"`, `"Huygens MTF"`, `"Spectral Collection Analysis"`.

**Blocked (not available in production):** `"Spot (Incoherent Irradiance) Through Focus"`, `"Grid Distortion"`, `"Distortion & Field Curvature"`, `"OPD (Optical Path Difference)"`, `"Ray Abberations (TRA and LRA)"`, `"Polarization Map"`. Do not offer or attempt these — the server will reject them.

`meta.numRays` must be an object keyed by light source part `id` values from `3doptix_parts_list` where `type === 8`; do not use labels, wavelengths, or display names as keys. Include every active light source in the setup.

For the default Advanced Incoherent offer, use `meta.name: "Spot (Incoherent Irradiance)"`, `meta.type: 1`, `meta.numRays` with `1000000` rays per active light-source ID, and explicitly pass `meta.resolution: { x: 300, y: 300 }`. This is a workflow preset, not the MCP tool default; if `meta.resolution` is omitted, `3doptix_analysis_run` defaults to `{ x: 500, y: 500 }`.

### Spot / Irradiance Analyses

| Analysis | Mode | Chat Presentation |
|----------|------|-------------------|
| `"Spot (Incoherent Irradiance)"` | FAST / ADV | Default Advanced Incoherent: `meta.type: 1`, 1,000,000 rays per active source ID in `meta.numRays`, explicit `meta.resolution: { x: 300, y: 300 }`. Rendered false-color image. Annotate: RMS radius, centroid, peak irradiance. |
| `"Spot (Coherent Irradiance)"` | ADVANCED | Rendered false-color irradiance map for coherent sources. Annotate: RMS radius, peak irradiance, visible fringes/interference if present. |
| `"Coherent Phase"` | ADVANCED | Rendered false-color phase map. Annotate: PV (waves), RMS wavefront error, qualitative aberration type. |
| `"Spectral Collection Analysis"` | ADVANCED | Use for multi-wavelength visible/RGB systems. Annotate color spread, collection balance, and wavelength-dependent behavior. |

### System-Level And Ray-CSV Analyses

| Analysis | Mode | Chat Presentation |
|----------|------|-------------------|
| `"Fresnel PSF"` / `"Huygens PSF"` | ADVANCED | Rendered false-color image. Annotate: Airy radius, peak-to-background ratio, encircled energy. |
| `"Fresnel MTF"` / `"Huygens MTF"` | ADVANCED | Rendered image or ASCII chart. Annotate: cutoff frequency, MTF @ 50 lp/mm, sagittal vs. tangential. |
| Spot Size on Sensor Plane | Ray CSV / `3doptix_simulation_analyze` | Text block: RMS radius, 1/e² diameter, encircled energy 80%/90%, centroid offset, rays on sensor. No `3doptix_analysis_run` call needed. |
| Focus Plane Distance | Ray CSV / `3doptix_simulation_analyze` | Text block: current detector z, paraxial focus z, delta (shift), min RMS at focus, RMS at detector. Converging beam only. |

**Not available in current MCP API:** OPD, Ray Aberrations, Grid Distortion, Distortion & Field Curvature, Polarization Map, Spot Through Focus (blocked server-side). Also not available: pupil aberration, lateral color, chromatic focal shift, Zernike standard coefficients.

For FAST analysis runs, keep `meta.resolution.x <= 100` and `meta.resolution.y <= 100`. This limit applies to analysis resolution, not detector physical size.

## Rendering Analysis Outputs

`3doptix_analysis_run` returns analysis `.bin.zip` data and `maps_url`; it does not by itself return a rendered PNG/JPEG. For analysis-image rows where the chat presentation says "rendered image" or "rendered false-color image", call `3doptix_analysis_render` after `3doptix_analysis_run` succeeds:

1. Use `analysisUrl` from the selected `data.analysis[].url` item.
2. Use `mapsUrl` from `data.maps_url`.
3. Use `mode: "image"` for normal chat presentation, or `mode: "zip"` when the user asks for downloadable plain image + overlay + metadata.
4. Default `displayType` to `"FALSE_COLOR"` for irradiance/spot, PSF, OPD, and phase maps unless the user requests another rendering style. Valid override strings are `"GRAY_SCALE"`, `"SPECTRAL_VIEW"`, and `"USER_DEFINED_COLORS"`.
5. Present the returned `data.imageUrl` or `data.zipUrl`.

## `3doptix_analysis_update` Restriction

`3doptix_analysis_update` applies the **same** `PROD_ALLOWED_ANALYSIS_TYPES` restriction as `3doptix_analysis_run`. Attempting to update an existing analysis to a blocked type (e.g., `"Grid Distortion"`, `"OPD (Optical Path Difference)"`) will throw a server-side error. Only the 15 prod-available types listed above are accepted.

---

## `3doptix_analysis_run` Usage Gate

Call `3doptix_analysis_run` only when:
- The user explicitly requests a specific analysis by name or number, or
- You judge it necessary, stop, explain why, and get user approval.

Never call `3doptix_analysis_run` proactively after `3doptix_simulation_run`, when `3doptix_simulation_analyze` already answers the question, or to verify collimation when simpler ray checks are sufficient.
