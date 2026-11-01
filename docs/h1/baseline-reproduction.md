# H1 baseline reproduction — EM

| Item | Recorded value |
| --- | --- |
| Owner | EM (`RS77713`) |
| Reviewer | MR (`makss-rivero`), pending |
| Issue | [#2: Reproduce and document Part I baseline](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/issues/2) |
| Repository | [Team management tool](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool) |
| Branch | `docs/em-h1-baseline` |
| Baseline tag | `part1-baseline` |
| Tested application commit | `bc304f1d954cb1e55d5ec7cdd06e49bba455613e` |
| Execution window | 2026-10-29 to 2026-10-30, Europe/Riga |
| Status | Automated reproduction and HTTP startup verified with npm 11; readiness gaps and independent review remain open |

## Purpose and inherited functionality

Record the actual inherited baseline before implementing Bug management.
The reachable annotated baseline tag and repository history remain unchanged.

Inherited areas:

- Home page with logo and health status.
- Dashboard with test-case, suite and run metrics.
- Test-case create/read/update/delete, CSV import and export.
- Test suites, case assignment and ordering.
- Test-run creation and passed/failed/skipped results.
- React/Vite frontend, Express API and SQLite persistence.
- Automated client/server checks and GitHub Actions.

The detailed inherited scope and provenance are recorded in
[the baseline record](../baseline.md). The selected feature contracts are
separate H1 proposals; this reproduction implements no new feature.

## Environment

- Windows: reported by .NET as `Microsoft Windows 10.0.26300`.
- Node.js: `v24.21.0`.
- System npm: `10.8.3`.
- Successful installation used task-local npm `11.19.1`.
- Windows PowerShell's user execution policy was previously repaired to
  `RemoteSigned`; its machine policy was retained.
- Project source and dependency lockfile were not modified during these checks.

The README currently permits npm 10 or newer. This machine did not reproduce a
successful clean install with npm 10; the exact limitation is recorded below.

## Commands and actual outcomes

| Check | Command | Outcome |
| --- | --- | --- |
| Initial locked install | `npm ci` with npm 10.8.3 | Failed: SQLite native rebuild could not find ClangCL (MSB8020). |
| Matched-environment install | `npx --yes --package npm@11.19.1 npm ci` | Exit 0; 201 packages added, 204 audited; install-script and vulnerability warnings retained. |
| SQLite runtime | Open/query/close a separate in-memory database using `better-sqlite3` | Passed; SQLite version `3.53.4`. |
| Lint | `npm run lint` | Exit 0; no warnings or errors reported. |
| Automated tests | `npm test` | Exit 0; 9 client test files / 40 client tests passed; 58 server tests passed, zero failures. |
| Production build | `npm run build` | Exit 0; Vite 8.3.0 transformed 53 modules and built successfully. |
| Development startup | `npm run dev` with a separate `DB_PATH` | API listening on 3001; Vite ready on 5173. |
| Client document | HTTP GET `http://localhost:5173/` | HTTP 200 with the Vite entry point. |
| API health | HTTP GET `http://localhost:3001/api/health` | `success: true`, `data.status: "ok"`, `error: null`. |
| Development proxy | HTTP GET `http://localhost:5173/api/health` | Same successful health envelope. |
| Core API smoke reads | Dashboard metrics and test-case list | Successful envelopes; synthetic seeds returned 5 cases, 2 suites and 1 run. |
| Dependency audit | `npx --yes --package npm@11.19.1 npm audit --json` | Exit 1 with 10 reported vulnerabilities: 3 moderate, 4 high, 3 critical. No remediation applied. |
| Visual browser review | Manual Home/navigation inspection | Pending; HTTP delivery is not a visual browser check. |
| Independent reproduction/review | MR review of this document | Pending. |

Results were captured on EM's Windows computer. Visual browser checks and MR's
independent review remain pending.

## Data isolation and startup

The startup check used a separate synthetic database under the ignored local
evidence directory. It did not use or replace the team's working database.

Example PowerShell startup after creating a suitable database directory:

```powershell
$env:DB_PATH = 'C:\path\to\existing\verification-folder\baseline.sqlite'
npm run dev
```

The first verification startup pointed at a directory not yet created and failed
with "Cannot open database because the directory does not exist". After creating
that directory, both servers started and the HTTP checks passed. This was a
verification setup error; its output is preserved separately from inherited
application defects.

The verification servers were stopped after the checks. The separate database
and logs were retained locally.

## Known defects, limitations and readiness gaps

1. **Windows installation prerequisites / npm consistency.** npm 10 initiated
   `node-gyp rebuild` for `better-sqlite3@13.0.3`, which failed because the
   configured ClangCL toolset was unavailable. npm 11.19.1 completed installation
   with an unreviewed-install-script warning; the SQLite module then loaded and
   all database-backed tests passed. The team must agree and document its npm
   version/script policy or provision the required Windows compiler tools.
   This run used task-local npm; system npm was not globally upgraded.
2. **Dependency advisories.** The saved current audit reports 10 vulnerabilities.
   Counts change with advisory data and do not establish exploitability. Detailed
   advisory/dependency paths are saved for investigation. A remediation or risk
   decision is required before release; this documentation change does not
   update dependencies.
3. **Visual verification.** Home page/navigation and health-response browser
   screenshots are not yet supplied for this EM run. Runtime HTTP results are
   available, so missing screenshots do not erase those verified observations.
4. **H1 design agreement.** Client/API alignment and the justified architecture
   decision still require team review before the new feature is implemented.
5. **Operations.** Application rollback and database restoration have not been
   demonstrated in this H1 reproduction; later milestones require that evidence.

npm documents the default native-build hook when a package has `binding.gyp`
without its own install hook:
[official npm package documentation](https://docs.npmjs.com/cli/v10/configuring-npm/package-json/).
The compiler failure itself is established by the preserved local error log.

## Evidence and follow-up

- [Published EM verification evidence](../evidence/em-baseline-evidence.md).
- [H1 baseline reproduction issue](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/issues/2).
- Raw local results: `docs/evidence/local/2026-10-30/`, including the failed
  install, successful matched-version install, SQLite runtime result, lint,
  full test output, build, startup, HTTP responses and detailed audit.
- Machine-readable check summary: `local/2026-10-30/checks.json` in that archive.
- Raw local files are intentionally ignored by Git. The published evidence
  summary contains selected command results for review; full local artifacts
  are available from EM on request and are not available through repository links.

This record supports H1 baseline discussion with explicit readiness gaps.
It is not approval of the full H1 deliverable or a release acceptance sign-off.
