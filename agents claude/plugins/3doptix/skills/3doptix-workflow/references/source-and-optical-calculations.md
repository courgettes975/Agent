# 3DOptix MCP — Source Rules & Optical Calculations

Read this reference before choosing/configuring a source type, setting source-specific parameters, collimating a diverging source, or doing pre-simulation optical calculations.

## Source Type Rules

### Choosing a Source Type

| Physical Source | 3DOptix `sourceType` | Notes |
|---|---|---|
| Collimated beam / laser (plane waves) | `PLANE_WAVE` *(default)* | No divergence. Shape controlled by `planeWaveShape`. |
| Gaussian laser beam | `GAUSSIAN_BEAM` | Diverging beam with defined waist radius and position. |
| Point source / isotropic emitter | `POINT_SOURCE` | Omnidirectional or cone-limited diverging source. Configure with `pointSourceDivergenceType`. |
| LED / IES-profile / extended emitter | `LED` | Angular emitter with IES-style distribution. |
| Measured beam from external file | `RAY_FILE` | Imports a pre-computed ray set from an external CSV/DAT file. |
| Fiber output | `GAUSSIAN_BEAM` | Waist radius = MFD/2 (single-mode) or core radius (multimode). Place waist at fiber facet. |

### Key Configuration Options

**`PLANE_WAVE` — beam cross-section** (`planeWaveShape`):
- `CIRCULAR` *(default)*
- `RECTANGULAR`
- `ELLIPTICAL`
- `ARBITRARY`

**`POINT_SOURCE` — divergence type** (`pointSourceDivergenceType`):
- `HALF_CONE_ANGLE` *(default)* — half-angle of the diverging cone in degrees
- `HALF_WIDTH_RECT` — half-width of a rectangular divergence cone
- `HALF_WIDTH_AT_Z` — half-width measured at a reference Z plane

**Ray density pattern** (`densityPattern`, applies to most source types):
- `CONCENTRIC_CIRCLES` *(default)*
- `XY_GRID`
- `RANDOM`

### Collimating Lens Verification (diverging sources)

- Required EFL: `f = beam_radius_target / tan(θ_div_half)`
- Verify lens NA ≥ sin(θ_div_half).
- Source-to-lens distance must equal selected EFL. If they differ, flag and resolve with user before placing any component.
- After lens selection, recompute expected output divergence and check against spec.

### LED / Extended Emitter Notes

- Default emitter size if unspecified: Ø0.1 mm (half-width 0.05 mm) — always inform the user.
- Always add a collimating lens as the first optical element for any diverging source.

## Optical Calculations (pre-simulation)

Before simulating, use analytical estimates to predict outcomes and catch obvious problems:

| Goal | Tool |
|------|------|
| Check if lens achieves target EFL | `3doptix_spherical_lens_maker_calculate_efl` |
| Find radii for target EFL | `3doptix_find_spherical_radii_for_target_efl` |
| Solve first radius when R2/EFL/thickness are fixed | `3doptix_lens_maker_calc_first_radius` |
| Solve second radius when R1/EFL/thickness are fixed | `3doptix_spherical_lens_maker_second_radius` |
| Solve thickness when EFL and both radii are fixed | `3doptix_spherical_lens_maker_thickness_for_efl` |
| Find material for target n | `3doptix_find_material_by_refrctv_idx` |
| Get n at wavelength | `3doptix_calculate_refractive_index` |
| Design beam expander | `3doptix_build_beam_expander_lenses` |
| Find ball lens diameter for target EFL | `3doptix_find_ball_lens_diameter_for_target_efl` |
