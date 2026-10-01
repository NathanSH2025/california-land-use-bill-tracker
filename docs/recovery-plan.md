# Recovery and migration plan

## Objective

Make the Bill Tracker independent of any single ChatGPT conversation.

## Baseline

The current ChatGPT Site is still the live user-facing tracker. ChatGPT exposes the existing Site to this conversation as a rendered Site projection, but not as directly exportable editable source code.

The dated file in `snapshots/` preserves the visible tracker state, including bill summaries, County-impact notes, recommended actions, counts, and tracker guidance.

## Migration plan

1. Preserve the current rendered tracker state.
2. Reconstruct the application in GitHub.
3. Separate application code from bill data and scan state.
4. Preserve the existing bill filtering, removed/not-tracking behavior, status terminology, County-impact logic, editable bill-text links, and scan rules.
5. Record all meaningful changes through Git commits.
6. Treat individual ChatGPT conversations as replaceable work sessions rather than the only copy of the project.

## Public-repository rule

Only public or otherwise appropriate-to-publish information should be committed to this repository.
