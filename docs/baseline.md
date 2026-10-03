# Part I Baseline

## Provenance

- Team: EM, MK, MR, BK
- Repository: https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool
- Baseline reference: `part1-baseline`

The application was developed jointly by the team before the Part II GitHub
collaboration exercise. The earlier working-copy history was unavailable, so
this repository records the agreed starting point as a single transparent
baseline commit and permanent annotated tag.

## Inherited scope

- React/Vite client and responsive navigation
- Home page with logo and API health status
- Dashboard with test-case and execution metrics
- Test case CRUD, CSV import, and CSV export
- Test suite CRUD, case membership, and ordering
- Test-run creation, immutable case snapshots, and result execution
- Express API and SQLite persistence
- Client and server automated tests

## Excluded from the baseline

The following capabilities are outside this baseline and may only be
introduced through reviewed Part II work:

- Settings
- Bug management
- Reports
- Flaky-test tracking
- External notification integrations

## Reproduction

Follow the setup and verification commands in the repository README. A clean
baseline is expected to install, lint, test, build, and start with Node.js 24.

## Data and secrets

- Never commit `.env` or SQLite database files.
- Use `.env.example` only for documented variable names.
- Use synthetic demonstration data; do not commit personal or confidential data.
- Store future deployment secrets in the hosting provider or GitHub secrets.
