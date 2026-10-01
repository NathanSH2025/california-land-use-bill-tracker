# AGENTS.md

## Canonical project rule

GitHub is the durable source of truth for this project.

Do not make a Bill Tracker change only in chat or only in a deployed UI. Any meaningful change to tracker code, data, rules, or documentation should be committed to this repository so a future session can recover the project without relying on conversation history.

## Current migration state

The existing ChatGPT Site remains the complete live tracker while the application is being reconstructed here. The repository already contains a rendered recovery snapshot from October 1, 2026.

New application work should be built in `site/` and supporting data/rules should be stored in version-controlled files.

## Public repository rule

This repository is intentionally public. Never commit:
- API keys, passwords, tokens, cookies, or credentials
- confidential County records
- personally identifying information that is not already public
- internal-only material that should not be publicly released

## Tracker behavior to preserve

- Legislative session must be tracked with each bill so reused bill numbers do not collide across sessions.
- Default tracked-bill view hides Chaptered, Vetoed, and other completed statuses unless selected.
- Removed / not tracking appears after the active tracked-bill views.
- Removed bills are excluded from normal scans unless explicitly restored.
- Permanently deleted bills remain blocked from rediscovery.
- Status labels should use official California legislative terminology, shortened only when necessary for the UI.
- Filters should support Select all / Clear all and concise information help.
- Bill summaries should not begin by repeating the bill number/name.
- County impacts and recommended actions must be specific to San Bernardino County LUS Planning and should account for existing Development Code, Countywide Plan / General Plan, and current workflows.
- Generic recommendations such as "review impacts" are not sufficient when a more concrete County action can be identified.
- Official bill-text links must be editable and point to the correct session/version.
- Scans must not impose an arbitrary candidate cap that can cause relevant bills to be missed.
- Filtering should aggressively exclude bills with no realistic LUS Planning relevance while preserving uncertain candidates for review.
- "No Changes Required" means no LUS Planning change identified; other County departments may still have responsibilities.

## Change workflow

1. Inspect the current repository state before editing.
2. Make the requested change in source/data.
3. Commit the change with a concise description.
4. Let the deployment workflow publish the updated staging site.
5. If a change affects tracker rules, update this file or `docs/` so future sessions inherit the decision.
