# 3DOptix MCP — File Upload Reference

Read this before any workflow that requires uploading a file (STEP/STP for CAD, `.opt` for setup import, ray files, images).

## General Upload Rules

| Rule | Detail |
|------|--------|
| `uploadPageUrl` expiration | 15 min. Present it to the user immediately after `request_file_upload`. |
| Polling interval | Every 10 s. Allow at least 10 attempts (~2 min) before declaring failure. Never ask user to confirm between polls. |
| Status flow | `pending → validating → complete` (use `s3Url`) or `failed` / `expired`. |
| Category mapping | STEP/STP → `"cad"`, ray file → `"ray_file"`, PNG/JPG → `"image"`, `.opt` → `"setup"`, other → `"generic"`. |
| MIME type mapping | STEP/STP → `"application/step"`, PNG → `"image/png"`, `.opt` → `"application/octet-stream"`. |

## Upload Workflow (all file types)

1. `3doptix_request_file_upload(contentType, category, size?)` — returns `token`, `uploadPageUrl`, `expiresAt`.
2. Present `uploadPageUrl` to the user; they upload in their browser. Do not ask for confirmation between polls.
3. `3doptix_get_upload_status(token)` — poll every 10 s until `status === "complete"`. On complete, use `s3Url` in the next step.
4. Proceed to the destination tool based on file type (see below).

## CAD / STEP File → Custom Optomechanics Part

```
request_file_upload(contentType: "application/step", category: "cad")
  → user uploads
  → poll get_upload_status until "complete"
  → cad_upload_and_process(s3Url, name, resolution?)   # 30–120 s
  → setup_add_optomechanics(setupIdentifier, number_id)
```

- `resolution` options: `"LOW"` / `"MEDIUM"` (default) / `"HIGH"`.
- `name`: use the file name from `get_upload_status` (strip extension); do not ask the user.
- Returns `number_id` — pass it to `setup_add_optomechanics`.
- Call `3doptix_get_tool_guide("cad_upload_and_process")` for full parameter details.

## Setup Import from `.opt` File

```
request_file_upload(contentType: "application/octet-stream", category: "setup")
  → user uploads
  → poll get_upload_status until "complete"
  → setup_create_from_file(s3Url, setupName?, unit?)
```

- `setupName`: optional override; if omitted, uses the name from the `.opt` file.
- `unit`: `"mm"` or `"inch"` override; if omitted, uses the unit from the `.opt` file.
- The created setup is private.

## Ray File Upload

```
request_file_upload(contentType: "application/octet-stream", category: "ray_file")
  → user uploads
  → poll get_upload_status until "complete"
  → use s3Url when configuring a RAY_FILE light source
```

## Error Handling

| Status | Action |
|--------|--------|
| `failed` | Report to user with `validation.message` if available. Ask whether to retry. |
| `expired` | The upload link expired (15 min). Call `request_file_upload` again for a fresh link. |
| Still `pending` after ~2 min | Report timeout; ask user to verify the file was uploaded and whether to retry. |
