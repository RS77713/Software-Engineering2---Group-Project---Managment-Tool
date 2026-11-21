# QA Management Tool

Part I team baseline for EM, MK, MR, and BK.

The application provides the core workflow needed to create test cases,
organize them into suites, execute test runs, and view current quality
metrics on a dashboard.

## Baseline scope

- Home page with application logo and API health status
- Dashboard with test-case and test-run metrics
- Test case creation, editing, deletion, CSV import, and CSV export
- Test suite creation, editing, case assignment, and ordering
- Test run creation and result execution
- Express API with SQLite persistence
- Automated client and server tests

The `part1-baseline` Git tag identifies the agreed starting point for Part II.
Later features must be developed through issues, feature branches, pull
requests, reviews, and automated checks.

## Requirements

- Node.js 24
- npm 11.19.1 (also pinned in CI and `package.json`)

Use one Node version consistently when installing and running the project.
`better-sqlite3` contains a native module and must be installed for the same
Node version used to start the server. Activate npm 11.19.1 with your version
manager, or install that exact npm version explicitly. Check `node --version`
and `npm --version` before installing dependencies.

## Setup

```bash
npm ci
npm run verify:sqlite
```

To use the pinned npm without changing the machine's global npm installation:

```bash
npx --yes --package npm@11.19.1 npm ci
npx --yes --package npm@11.19.1 npm run verify:sqlite
```

Use the same `npx --yes --package npm@11.19.1 npm` prefix for the commands below
when using task-local npm. The engine check rejects unsupported install tools.

Dependency install scripts require an explicit project decision. The locked
`better-sqlite3` package includes prebuilt binaries; its unnecessary fallback
compiler script is denied. Optional `fsevents` install scripts are also denied.
New unreviewed install scripts fail installation. Do not bypass that failure
with a blanket script approval: review the dependency and run the native probe,
tests and build after any policy change. A platform without a usable prebuild
needs a separately reviewed setup rather than an automatic compiler fallback.

## Development

```bash
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:3001
- Health check: http://localhost:3001/api/health

The Vite development server proxies `/api/*` requests to Express.

## Verification

```bash
npm run lint
npm run verify:sqlite
npm test
npm run build
```

## Production

```bash
npm run build
npm start
```

Express serves the production client build and API from port `3001` by
default.

Current dependency advisories remain unresolved; this baseline is for isolated
synthetic-data development/verification. Review
[the dated readiness record](docs/h1/readiness.md) and
[release dependency gate #11](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/issues/11)
before shared/public deployment or release acceptance.

## Data

SQLite data is stored in `server/data.sqlite` by default. Set `DB_PATH` to
use a different location. Local database files and `.env` files are ignored
by Git and must never be committed.

## Repository workflow

1. Create a GitHub issue for the work.
2. Create a branch such as `feature/mk-task-name`.
3. Commit focused changes.
4. Push the branch and open a pull request into `main`.
5. Obtain the required reviews and passing checks before merging.
