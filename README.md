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
- npm 10 or newer

Use one Node version consistently when installing and running the project.
`better-sqlite3` contains a native module and must be installed for the same
Node version used to start the server.

## Setup

```bash
npm ci
```

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
