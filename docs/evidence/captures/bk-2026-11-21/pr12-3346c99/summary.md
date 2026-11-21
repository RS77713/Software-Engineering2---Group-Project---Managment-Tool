# BK independent verification — PR #12 at 3346c99

Fresh clone, exact commit `3346c997cbab435d3667c5af7242424a31ee57ab` (2026-11-21, Europe/Riga). OS: macOS/Darwin 27.0.0 arm64. Node `v24.20.0`; npm `11.19.1` via `npx --yes --package npm@11.19.1 npm`.

| Command | Result |
|---|---|
| `npm ci` | PASS; 202 packages added, 205 audited; npm reports 10 vulnerabilities: 3 moderate, 4 high, 3 critical. |
| `npm run verify:sqlite` | PASS; SQLite 3.53.4, Darwin ARM64 native binding loaded, write/read passed. |
| `npm install-scripts ls` | PASS; no packages with unreviewed install scripts. |
| `npm run lint` | PASS. |
| `npm test` | PASS; 40 frontend + 60 backend = 100 tests. |
| `npm run build` | PASS; Vite 8.3.0 transformed 53 modules. |
| `npm run start:isolated` | Started after the build; actual bind `127.0.0.1:3001` (IPv4). Temporary database directory: `/var/folders/qd/svj04r_x0ss6sfjx_sbd5v5h0000gn/T/qa-baseline-isolated-UsycyW`; database: `/var/folders/qd/svj04r_x0ss6sfjx_sbd5v5h0000gn/T/qa-baseline-isolated-UsycyW/synthetic.sqlite`. |
| Page / health | `GET /` returned HTTP 200, `text/html`, title `Bootcamp App`; `GET /api/health` returned HTTP 200 and `{success:true,data:{status:"ok"},error:null}`. Seed API returned 5 synthetic test cases. |
| Stop | Sent Ctrl+C; process exited 0. Follow-up health connection failed as expected. The temporary SQLite file remained at the printed location. |

npm emitted `Unknown env config "global-ignore-file"` during commands. The audit findings remain unresolved and tracked by issue #11; these passes do not establish that advisories are harmless or fixed.

Earlier results for `fd00782` remain separately preserved under `pr12-fd00782/`; this run does not replace them.
