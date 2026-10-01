# California Land Use Bill Tracker

Public source-control and recovery repository for the California land-use bill tracker used for San Bernardino County LUS Planning work.

## Why this repository exists

The tracker was previously dependent on individual ChatGPT conversations. Multiple long-running Bill Tracker conversations became stuck in a permanent Working/generation state, which made continued editing unreliable.

This repository is intended to become the durable source of truth so the project can be recovered and continued from any future development session.

## Current status

The live tracker remains available at:

https://lus-california-land-use-bills.nathansh.chatgpt.site

The first migration step is preserving the current rendered tracker state in `snapshots/`. That snapshot is a recovery reference, not the original editable ChatGPT Site source code.

The next step is to reconstruct the application source, data model, scan logic, and tracker rules here and then use GitHub version history for all meaningful changes.

## Repository visibility

This repository is intentionally public. Do not commit credentials, API keys, confidential County records, personally identifying information, or other material that is not appropriate for public release.
