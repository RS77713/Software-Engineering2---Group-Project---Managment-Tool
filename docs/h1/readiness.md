# H1 readiness follow-up — EM

| Item | Value |
| --- | --- |
| Date | 2026-11-21, Europe/Riga |
| Owner / reviewers | EM / MR (change review), BK (independent setup check) |
| Issue | [#10: Baseline setup and readiness](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/issues/10) |
| Branch | `codex/em-h1-readiness` |
| Starting main | `50ed8fa47aba6434410bd52006ee71f5c2a314a6`, after architecture PR #9 |
| Application source | Unchanged from `part1-baseline`, `bc304f1d954cb1e55d5ec7cdd06e49bba455613e` |
| Status | Setup repair and agent verification prepared; EM personally inspected Home/Dashboard screenshots; MR/BK independent review pending |

## Architecture integration

[PR #9](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/9)
merged after MR approved `8eb48e1`, BK confirmed its verification additions, and
MK confirmed the unchanged client decisions. Main CI passed at merge commit
`50ed8fa`. The [architecture decision](architecture-decision.md) and API/client
contracts describe future implementation; Bug management remains unimplemented.

## Reproducible install decision

Use Node 24 and npm **11.19.1**, with exact npm engine enforcement and the same
version installed on the CI runner. Task-local pinned npm is supported without
altering the user's global npm. Keep dependency versions and integrity records
unchanged in this setup repair; the lockfile edit adds only root npm metadata.

Use `strict-allow-scripts=true`. Explicitly deny the locked packages'
`better-sqlite3` and optional `fsevents` install scripts. Inspecting the shipped
SQLite package showed `prebuilds` and a loader which selects the matching
binary. The earlier npm 10 fallback `node-gyp rebuild` was not needed for this
Windows platform. The fresh install below proves a packaged binary loads,
writes and reads; successful package extraction alone would not establish that.

New unreviewed lifecycle scripts fail installation. Unsupported native targets
need a reviewed compiler/prebuild decision; do not silently approve all scripts.
BK must independently check his platform; Windows success is not a claim that
every OS/CPU has been verified. CI adds the native probe before existing checks.

Policy semantics: [npm's official ci/script-policy documentation](https://docs.npmjs.com/cli/v11/commands/npm-ci/).
The project policy records explicit denials and rejects unreviewed entries.

## Actual fresh-copy results

An archive of starting main was extracted without `node_modules`, then overlaid
with this branch's root package/lock metadata, `.npmrc` and native-probe script.
The copy and a separate synthetic SQLite database live under the ignored local
evidence directory. The application's source and locked dependency versions
were unchanged. The archived copy received its own Git boundary so the outer
evidence-ignore rule did not hide its source from the linter.

Environment: Windows `10.0.26300`, Node `v24.21.0`, pinned npm `11.19.1`.
System npm `10.8.3` was left installed; it did not perform the recorded clean
install. The exact tested file hashes are in the linked check summary.

| Check | Actual outcome |
| --- | --- |
| Pinned `npm ci` | Exit 0; 201 packages added, 204 audited; no unreviewed-script notice. |
| `npm install-scripts ls` | No packages with unreviewed install scripts. |
| `npm run verify:sqlite` | Exit 0; SQLite `3.53.4`; `prebuilds/win32-x64.node`; write/read passed. |
| `npm run lint` | Passed after fixing the verification copy's ignore-boundary setup. |
| `npm test` | 40 frontend tests in 9 files and 58 backend tests passed; 98 total, zero failures. |
| `npm run build` | Passed; Vite 8.3.0, 53 modules. |
| Full audit | Exit 1; 10 affected-package records: 3 moderate, 4 high, 3 critical. |
| Production-only audit | Exit 1; 3 records: 1 moderate, 1 high, 1 critical. |
| Compatible-fix dry run | `npm audit fix --package-lock-only --dry-run --json`: exit 1, zero changed packages, same reported totals. No forced upgrade applied. This does not prove a compatible repair is impossible. |

The first lint attempt reported no input files because the extracted copy was
under an ignored parent directory. Its original log was retained; adding an
isolated Git boundary fixed the harness. This was not an application defect.
All normal checks then passed. No application test was added to imitate an
implementation; the new SQLite command verifies the actual native prerequisite.

## Browser observation

The agent started the built Express application with a loopback-only verification
listener at `127.0.0.1:3001` and a new synthetic database, inspected it through
the browser, then stopped it. This used the real `server/app.js` and production
client build; the listener harness is not a change to the normal start command.

- Home logo, navigation and displayed server status `ok` rendered.
- Dashboard showed 5 cases, 2 suites, 1 run and 50% pass rate.
- Navigation opened Test Cases (5 records), Test Suites (2), Test Runs (1), and
  the existing execution-detail page with its results/notes/controls.
- Browser API health displayed `success: true`, `data.status: "ok"`, `error: null`.
- No application data was edited through the UI. This observation does not test
  the future Bug feature, all CRUD paths, mobile layouts or every keyboard flow.
- Inherited presentation observations: the browser title remains `Bootcamp App`,
  and the Dashboard's Recent Test Runs table uses basic styling. These did not
  prevent navigation/data display; they are recorded without being repaired here.

The live navigation and captures are **agent-observed**. On 2026-11-21, EM
explicitly confirmed personally inspecting the Home and Dashboard screenshots
and their displayed results. This establishes that specific screenshot review;
it does not establish that EM personally navigated the live app, reran commands
or inspected every other page. Those results retain their actual agent scope.

## Evidence and dependency disposition

- [Machine-readable results and hashes](../evidence/captures/em-2026-11-21/verification.json).
- [SQLite runtime](../evidence/captures/em-2026-11-21/sqlite-runtime.txt),
  [installation](../evidence/captures/em-2026-11-21/install-pinned.txt) and
  [script-policy check](../evidence/captures/em-2026-11-21/script-policy.txt).
- [Full audit JSON](../evidence/captures/em-2026-11-21/audit-full.json) and
  [production audit JSON](../evidence/captures/em-2026-11-21/audit-production.json).
- [Home](../evidence/captures/em-2026-11-21/home.jpg),
  [Dashboard](../evidence/captures/em-2026-11-21/dashboard.jpg),
  [Test Cases](../evidence/captures/em-2026-11-21/test-cases.jpg),
  [Test Suites](../evidence/captures/em-2026-11-21/test-suites.jpg),
  [Test Runs](../evidence/captures/em-2026-11-21/test-runs.jpg),
  [execution detail](../evidence/captures/em-2026-11-21/execution.jpg), and
  [API health](../evidence/captures/em-2026-11-21/api-health.jpg).

Full logs, the initial harness failure, install copy and synthetic database
remain local under `docs/evidence/local/2026-11-21/readiness/`. No database,
credentials or private chat captures are published.

EM proposes retaining the inherited dependency lock for isolated synthetic-data
development while a focused repair is reviewed. This disposition needs MR's
review; it is not a declaration of safety. Production records include
`body-parser` (high), `proxy-addr` (critical) and `qs` (moderate); the full audit
also includes development/test/build packages. Neither passing tests nor the
script policy resolves the advisories.

[Dependency issue #11](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/issues/11)
records the actual package/advisory paths, MR/EM repair ownership and BK's
independent verification. Resolve and review the findings/disposition and trust
boundary before public/shared exposure or H3 release acceptance. Audit counts
are dated observations; they can change as advisory data changes.

MR must review this setup/readiness change and proposed advisory disposition;
BK must independently reproduce the pinned install and native/application
checks on his environment. These remain H1 readiness actions; the specific EM
screenshot review above does not certify full H1 or release acceptance. Codex
assisted the changes, command/browser execution and evidence capture on EM's behalf.
