# BK Verification Results

This note supplements the screenshot evidence in [verification_notes.docx](verification_notes.docx) and clarifies the historical run and a fresh verification. It supersedes the earlier summary that said “all 58 client and server tests”: the screenshots show 40 frontend tests and 58 backend tests.

## Historical verification — 2026-10-15

The terminal screenshots show `npm ci`, `npm run lint`, `npm test`, and `npm run build`.

- **Application code SHA:** `bc304f1d954cb1e55d5ec7cdd06e49bba455613e`. The terminal screenshot does not show a SHA command. This code SHA is reconstructed from the verification branch and PR base: the branch was created from the then-current `main` at this commit, and the branch changes after it are documentation-only.
- **Node.js:** Exact historical version was not captured. The project requires Node.js `>=24 <25`, which does not establish the installed patch version.
- **npm:** The `npm ci` screenshot shows npm’s update notice `12.0.2 -> 12.2.0`, indicating npm `12.0.2`; no separate `npm --version` output was captured.
- **Tests:** 40 frontend tests passed and 58 backend tests passed, for 98 total, as shown in the separate client and server output.
- **Captured dependency warning:** The `npm ci` output reported 4 vulnerabilities (1 high, 3 critical). The screenshots do not include package/advisory details or an audit report, so their applicability and current status are unassessed. No remediation is recorded; this result does not establish that the vulnerabilities are harmless or fixed.
- **Captured install-script warning:** npm reported that install scripts were blocked for `better-sqlite3@13.0.3` (`node-gyp rebuild`) and `fsevents@2.3.3`. Those scripts did not run during that install. The later passing tests show that the available environment ran the suites; they do not establish that skipped scripts are harmless or that clean installs are reproducible in every environment.

## Fresh verification — 2026-11-14

Fresh checks were run on `test/bk-h1-verification` at repository checkout SHA `0c51a1abd33c70de58cff1f09c67ad351e282f56`, before this supplemental documentation commit. That checkout's application code is still `bc304f1d954cb1e55d5ec7cdd06e49bba455613e`; the commits between them change documentation only.

- **Node.js:** `v24.20.0`
- **npm:** `12.0.2`
- **Install:** `npm ci` completed with exit code 0. It again reported blocked install scripts for `better-sqlite3@13.0.3` and `fsevents@2.3.3`. This run did not print a vulnerability count, and `npm audit` was not run. The historical vulnerability warning therefore remains unassessed, not declared fixed.
- **Lint:** `npm run lint` completed with exit code 0.
- **Frontend:** `npm test -w client` — 40 passed, 0 failed.
- **Backend:** `npm test -w server` — 58 passed, 0 failed.
- **Total:** 98 passed, 0 failed across the two test suites.
- **Production build:** `npm run build` completed successfully with Vite 8.3.0.

The fresh test and build results describe this verification environment. They do not change the historical record or resolve the dependency vulnerability and blocked-script warnings.
