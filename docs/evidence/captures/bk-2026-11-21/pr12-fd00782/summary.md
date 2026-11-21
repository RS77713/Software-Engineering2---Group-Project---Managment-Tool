# BK independent PR #12 verification — fd00782

Verified in a fresh clone at `fd0078290a1dc3c763f3506071e918bb660b321c` on 2026-11-21 (Europe/Riga), macOS/Darwin 27.0.0 arm64, Node v24.20.0, npm 11.19.1. Full command output is in the adjacent `.txt` logs.

| Command | Result |
| --- | --- |
| `npm ci` | PASS, exit 0; 202 packages added, 205 audited. npm reported 10 vulnerabilities: 3 moderate, 4 high, 3 critical. |
| `npm run verify:sqlite` | PASS, exit 0; SQLite 3.53.4, darwin-arm64 native binding loaded, write/read passed. |
| `npm install-scripts ls` | PASS, exit 0; no packages with unreviewed install scripts. |
| `npm run lint` | PASS, exit 0; no lint output/errors. |
| `npm test` | PASS, exit 0; 9 client test files / 40 tests, 58 server tests, 98 total. |
| `npm run build` | PASS, exit 0; Vite 8.3.0, 53 modules transformed. |

Warnings: npm printed `Unknown env config "global-ignore-file"` during commands (a warning from the execution environment's npm config). The install audit reported the vulnerabilities above. The audit findings are unresolved; these successful checks do not establish that they are harmless or fixed. Keep the production/full audit findings tracked in issue #11 and resolve the release gate before release.

Scope: this verifies the requested setup/runtime/test/build commands at historical commit `fd00782`; it does not certify later PR revisions or the newer isolated-startup change.
