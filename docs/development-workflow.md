# Development and deployment workflow

## Goal

A stuck ChatGPT conversation must never strand the Bill Tracker again.

## Source of truth

The GitHub repository is the permanent record of code, data, and tracker rules. Chat conversations are work sessions, not the only copy of the project.

## Deployment

The repository includes a GitHub Pages workflow at:

`.github/workflows/deploy-pages.yml`

After GitHub Pages is enabled with **GitHub Actions** as the publishing source, every push to `main` that changes the staging site can be deployed automatically.

## Migration status

The current ChatGPT Site is still the full working tracker. The GitHub-hosted version is a staging environment until the complete application and bill dataset are migrated.

Do not retire or overwrite the existing live tracker until the GitHub version has been checked against it for:
- bill count
- tracked/removed status
- status filters
- categories
- County impact classifications
- summaries
- recommended actions
- official links
- scan state and discovery rules

## Future change workflow

Once migration is complete:

1. User requests a tracker change.
2. The change is made in GitHub.
3. A commit records the change.
4. GitHub Actions deploys it.
5. The live tracker updates from the committed source.

There is no separate manual backup step because the commit itself is the backup and audit trail.
