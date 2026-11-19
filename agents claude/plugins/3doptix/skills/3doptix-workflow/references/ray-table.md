# 3DOptix MCP — In-Memory Ray Table

## Background & Motivation

The S3 URLs returned by `3doptix_simulation_run` are inaccessible from the Claude container due to network proxy restrictions. However, `3doptix_simulation_analyze` returns the **complete per-surface ray data** — hit positions, directions, and amplitudes for every ray on every surface — directly in its JSON response. This document defines how to capture, maintain, and use that data as a first-class in-memory ray table throughout the session.

---

## What to Capture

After every `3doptix_simulation_analyze` call, extract the `surfaceHits` array from the response and store it as the **session ray table**. Each entry in `surfaceHits` contains:

| Field | Description |
|-------|-------------|
| `surfaceId` | 3DOptix surface ID string |
| `hitCount` | Number of rays hitting this surface |
| `hitPositions` | Array of `[x, y, z]` hit coordinates (mm) |
| `directions` | Array of `[dx, dy, dz]` unit direction vectors |
| `amplitudes` | Array of amplitude (irradiance weight) values |
| `beamFootprint` | `{width, height}` in mm — pre-computed by the backend |
| `positionRange` | `{x: [min,max], y: [min,max], z: [min,max]}` — bounding box |
| `averageAmplitude` | Mean amplitude across all rays on this surface |
| `maxAmplitude` | Peak amplitude on this surface |

Also capture the `detectorPerformance` block:
- `raysReachingDetector`, `primaryRaysEmitted`, `collectionEfficiency`
- `beamFootprint` on the detector (the most important summary metric)

---

## Storage Structure (Conceptual)

Maintain one object per session — `SESSION_RAY_TABLE` — with the following shape:

```
SESSION_RAY_TABLE = {
  setupName: string,
  simulationTimestamp: string,
  totalRays: number,
  wavelengths: number[],
  surfaces: [
    {
      surfaceId: string,
      surfaceName: string,
      partLabel: string,
      hitCount: number,
      hitPositions: [[x,y,z], ...],
      directions: [[dx,dy,dz], ...],
      amplitudes: [a1, a2, ...],
      beamFootprint: {width, height},
      positionRange: {x:[min,max], y:[min,max], z:[min,max]},
      averageAmplitude: number,
      maxAmplitude: number,
    },
    ...
  ],
  detector: {
    surfaceId: string,
    raysReachingDetector: number,
    collectionEfficiency: number,
    beamFootprint: {width, height},
  }
}
```

**Surface name resolution:** Cross-reference each `surfaceId` against the known part layout (from `3doptix_parts_list` + `3doptix_parts_get_detailed`) to populate `surfaceName` and `partLabel`. If a surface ID is `−1`, label it `"Far-field / propagated"`.

---

## When to Update

| Trigger | Action |
|---------|--------|
| Every `3doptix_simulation_analyze` completes | **Replace** entire `SESSION_RAY_TABLE` |
| Any component position/rotation change + re-simulation | **Replace** (do not accumulate stale data) |
| Detector or light source reconfigured + re-simulation | **Replace** |
| User asks for ray data without a new simulation | **Use existing table** — do not re-simulate |

**Never merge old and new ray tables.** Always replace fully after each simulation.

---

## Analyses Derived from the In-Memory Table

Use `SESSION_RAY_TABLE` directly to answer these requests without additional tool calls:

| User Request | Derived From |
|---|---|
| "What is the beam size on the detector?" | `detector.beamFootprint` |
| "Show me beam size at each surface" | `surfaces[*].beamFootprint` |
| "How many rays reached the detector?" | `detector.raysReachingDetector` |
| "What is the collection efficiency?" | `detector.collectionEfficiency` |
| "Show the ray table as a file" | Serialize `SESSION_RAY_TABLE.surfaces` to CSV (see Exporting to CSV below) |
| "What is the RMS beam radius?" | Compute from `hitPositions` of detector surface (see RMS Calculation below) |
| "Show amplitude distribution" | Use `amplitudes` array of detector surface |
| "What is the centroid position?" | Mean of `hitPositions` x and y for detector surface |
| "How does the beam grow through the system?" | `beamFootprint.width` vs `z` across all surfaces |
| "Are any rays lost?" | Compare `totalRays` emitted vs `detector.raysReachingDetector` |

---

## Exporting to CSV

When the user asks for a ray table file, serialize `SESSION_RAY_TABLE` to CSV with columns:

```
ray_id, surface_id, surface_name, part_label,
hit_x_mm, hit_y_mm, hit_z_mm,
dir_x, dir_y, dir_z,
amplitude
```

One row per ray per surface. Write to `/mnt/user-data/outputs/ray_table_<setupName>.csv` and call `present_files`. Do not attempt to download from S3 — the in-memory data is authoritative.

---

## RMS Beam Radius Calculation

From the detector surface `hitPositions` array, compute:

```
centroid_x = mean(x_i)
centroid_y = mean(y_i)
RMS_radius = sqrt( mean( (x_i - cx)^2 + (y_i - cy)^2 ) )
diameter_rms = 2 × RMS_radius
```

Report as: `RMS radius = X.XX mm`, `1/e² diameter ≈ Y.YY mm` (note: for a uniform top-hat beam, 1/e² ≈ 1.41 × RMS).

---

## Known Limitations

| Limitation | Guidance |
|------------|---------|
| Ray count limited by `visCount` on the light source (default 50) | `visCount` can be set on `3doptix_light_source_create` only. For existing sources, do not call `3doptix_light_source_configure` with `visCount`; create a replacement source with the desired `visCount` only if the user approves. |
| `3doptix_simulation_analyze` ray data is per-surface, not full ray paths | Cannot reconstruct individual ray trajectories across surfaces |
| Surface ID `−1` is a virtual far-field plane | Exclude from beam-size metrics unless user specifically asks |
| Amplitude values are relative (not absolute watts) | Report as normalized or relative units unless calibration is known |
