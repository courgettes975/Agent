# Agents claude

Export des agents et skills du compte (19/11/2026).

- `agents/` : orchestrator + 8 agents spécialisés (format Claude Code).
- `skills/` : 19 skills du compte + 4 skills de projet (debug-issue, explore-codebase, refactor-safely, review-changes).
- `plugins/` : les 77 plugins installés (dont `maigret`, plugin personnel).
- `plugins/INVENTAIRE.md` : liste des plugins avec leur origine.

## Installation sur un PC Windows
- Agents : copier `agents\*.md` dans `%USERPROFILE%\.claude\agents\` (tous projets) ou `<projet>\.claude\agents\`.
- Skills : copier chaque dossier de `skills\` dans `%USERPROFILE%\.claude\skills\`.
- Plugins : copier le dossier du plugin voulu dans un dossier de plugins local, puis l'installer avec `/plugin` dans Claude Code.
