# 3DOptix MCP — Custom Catalog Components

Read this reference before creating any custom catalog lens, mirror, aperture, grating, or multiplet with `3doptix_lens_create`, `3doptix_mirror_create`, `3doptix_aperture_create`, `3doptix_grating_create`, or `3doptix_multiplet_create`.

> The lens-radius sub-routine (refractive index → radii → EFL verification → manufacturability) is defined inline in SKILL.md §6.2. This reference covers what's specific to **catalog creation**: variant selection, parameter constraints, mirror coatings, and post-creation behavior. Do not duplicate the sub-routine here — follow §6.2 first, then use the rules below.

## Workflow Summary

1. Run the **Lens Geometry Sub-Routine** below for any lens (or the equivalent geometry calc for mirrors/gratings).
2. For multiplets only: call `3doptix_calculate_multiplet_min_thickness` first to verify the design is physically realizable.
3. When BFL, FFL, or principal-plane placement matters, compute those values manually from thick-lens equations and state the sign-convention assumptions. Do not present BFL or FFL as values returned by an MCP tool unless the response explicitly includes them.
4. Create the catalog entry — use `checkExist: true` to avoid duplicates.
5. Add to setup with `3doptix_setup_add_optics`, passing the `number_id` value as `componentNumberId`.

> ⚠️ **`number_id` vs `id`:** Search and creation tools return both `id` (Elasticsearch document ID, internal use only) and `number_id` (the catalog component ID). The `3doptix_setup_add_optics` parameter is **`componentNumberId`** — always pass the `number_id` value. Passing `id` will fail or place the wrong component.

## Lens Geometry Sub-Routine

Hardcoded or eyeballed radii almost always miss the target EFL by 10–30 % — small radius errors integrate into large focal-length errors via the lens-maker equation, and the user only sees the problem after running a simulation. Run this sequence before every `3doptix_lens_create`.

### Step A — Refractive index at design wavelength
```
3doptix_calculate_refractive_index(
  material: "N-BK7",
  wavelength: { value: 550, units: "nm" }
) → n
```
Glasses vary by ~0.01–0.03 in refractive index across the visible band, so a generic `n = 1.5` assumption can shift EFL by several percent. Compute `n` at the actual design wavelength. For multi-wavelength systems, compute at each λ and target the primary one. Use the optional `company` param (e.g. `"Schott"`) to disambiguate when multiple materials match.

### Step B — Radii from EFL, n, thickness
```
3doptix_find_spherical_radii_for_target_efl(
  refractive_index: n,
  efl: <target EFL>,
  system_units: "mm",
  central_thickness: T    ← starting value: D / 20 (D = clear aperture diameter)
) → { r1, r2 }  per lens subtype
```
There is no shape-factor parameter — the tool returns radii for all valid subtypes (biconvex, plano-convex, etc.). Choose the subtype that best matches the design.

### Step C — Verify EFL
```
3doptix_spherical_lens_maker_calculate_efl(
  refractive_index: n,
  r1: <value>,
  r2: <value>,
  central_thickness: T
) → efl
```
EFL must match target within ≤ 1 % (≤ 0.1 % for precision systems). If off: adjust `central_thickness` or choose a different subtype's radii, then re-verify.

### BFL and detector position

Always report **BFL** and principal plane shift `H = EFL − BFL` to the user. Compute BFL analytically:
```
BFL = EFL·(1 - (n-1)·T / (n·R1))
```
Detector position when the lens is centered at z = 0:
```
z_detector = T/2 + BFL        ← never place at EFL from lens center
```

### Manufacturability check

Run before `3doptix_lens_create`:
```
sag(R, D) = R - √(R² - (D/2)²)
E = T - sag(R1, D) - sag(R2, D)    [edge thickness, biconvex]
Required: T ≥ 1 mm  AND  E ≥ 1 mm
```
If either fails: increase `T` by 1 mm, re-call `3doptix_find_spherical_radii_for_target_efl`, re-verify. Iterate until both pass. For biconcave lenses the center thickness floor (`T ≥ 1 mm`) applies instead of edge thickness.

### Full sequence
```
1. 3doptix_calculate_refractive_index(material, wavelength) → n
2. 3doptix_find_spherical_radii_for_target_efl(n, efl, system_units, central_thickness) → r1, r2
3. 3doptix_spherical_lens_maker_calculate_efl(n, r1, r2, central_thickness) → verify EFL
4. Manufacturability check (sag + edge/center thickness)
5. 3doptix_lens_create(variant, r1, r2, central_thickness, materialId, diameter, ...)
   ← materialId = number_id from 3doptix_material_search_by_name (e.g. "n-bk7_schott")
```

## Component Variant Reference

**Lens variants** (`3doptix_lens_create` → `variant`): `spherical`, `conic`, `biconic`, `aspheric`.

**Aperture variants** (`3doptix_aperture_create` → `variant`): `rectangular`, `rectangular_with_elliptical_stop`, `elliptical`, `elliptical_with_rectangular_stop`.

**Mirror variants** (`3doptix_mirror_create` → `variant`): `circular`, `rectangular`, `roof_prism`, `right_angle`, `off_axis_parabolic`, `parabolic`, `cylindrical`, `curved`.

## Parameter Rules & Constraints

### `3doptix_lens_create` — spherical variant, r1/r2

For `variant: "spherical"`, at least one of `r1` or `r2` must be provided; providing only `r2` (omitting `r1`) is valid. The tool auto-orients so the curved surface becomes `r1` and the flat surface becomes `r2`. Do **not** pass `0` or `null` for the omitted radius — omit the field entirely.

### `3doptix_grating_create` — transmission variant

For `variant: "transmission"`, `blazeAngle` (in radians) and `blazeWavelength` (in nanometers) are **required**. Omitting either will throw a runtime error. For reflective variants they remain optional.

### `3doptix_aperture_create` and `3doptix_aperture_configure` — phase range

`innerPhase` and `outerPhase` must be in the range **[0, 2π]** radians (approximately 0 to 6.2832). Values outside this range fail schema validation.

### `3doptix_optics_update` on public catalog optics

Calling `3doptix_optics_update` on a **public** catalog optic causes the backend to auto-clone it as a new private entry with a different `number_id`. The response will include `cloned: true`, `originalNumberId`, and the new `number_id`. If the optic was already in a setup, call `3doptix_setup_add_optics` with the new `number_id` to replace the reference — the setup still points to the old public ID until updated.

### `materialId` format

`materialId` in all creation tools must be the `number_id` value returned by `3doptix_material_search_by_name` — this is lowercase with a vendor suffix (e.g., `"n-bk7_schott"`, `"sf11_schott"`). Do **not** use display names like `"N-BK7"` or `"SF11"` — these will fail or select the wrong material.

## Mirror Coatings & Catalog Selection

### Custom mirrors via `3doptix_mirror_create`

Mirror coating defaults to `ideal_reflector` — omit `coating` when that default is acceptable. If overriding coatings, use a verified coating object such as `{ front: "ideal_reflector" }`. Do not use unverified coating names like `"Perfect Reflector"` — they will silently fail or be ignored. Do not set a rear absorbing coating unless a valid coating identifier or surface behavior is verified.

### Catalog mirror candidates (Edmund Optics protected-silver)

Candidate mirror `number_id`s vetted by management for general use:
`89-463`, `89-467`, `89-470`, `45-757`, `89-475`, `89-482`, `45-758`, `89-487`, `89-488`, `89-494`, `48-017`.

Always verify availability and exact specs with `3doptix_optics_get` before adding via `3doptix_setup_add_optics` — these IDs were correct at the time of writing but catalog state can change.
