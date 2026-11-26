# BK — H2 integration verification

**Status:** Independent integrated verification completed at checkpoint `2b76cd99d4244d98023bcdd3b93ab17d2e3bdd15`. The historical client-only checks and earlier review observations remain separately recorded below.

## Scope and source of expected behaviour

Prepared from the merged H1 [API contract](../h1/bug-api-contract.md), [client behaviour contract](../h1/client-behaviour.md), [architecture decision](../h1/architecture-decision.md) (R1–R8), [H2 backend acceptance issue #16](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/issues/16), and current [backend PR #17](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/17) / [client PR #18](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/18). I found no separate H2 brief file in the repository. The standalone backend and client PRs are not yet an integrated, reviewed checkpoint.

The assessed journey will use a fresh isolated checkout, supported Node 24/npm 11.19.1, the documented install/native probe/lint/test/build steps, and `npm run start:isolated`. Use only synthetic records. Record OS/architecture, exact tested application SHA, runtime versions, commands and exit/results. Confirm the process-reported loopback address and temporary SQLite path, check UI/API health, and stop the process after observation. Keep setup/regression results distinct from journey outcomes. No public deployment or H3 sensitivity campaign is in scope.

## Synthetic fixture and expected journey

Use a disposable database with one suite, one case and one completed run containing result `R` with `result: "failed"`; record the actual IDs from the API/SQLite rather than assuming example IDs. Use synthetic form values:

- Title: `BK H2 synthetic defect — 😀`
- Steps: `Open the synthetic form; submit the saved fixture.`
- Expected: `A validation message is shown.`
- Actual: `The form advances without validation.`
- Severity: `Major`

Expected create body is `{title, description, severity, sourceResultId: R.id}` where `description` is exactly `Steps: …\nExpected: …\nActual: …`; do not send `testCaseId`, status, run ID or read-only fields. Opening the form and marking a result failed must create no Bug. Explicit submission should return 201 and a complete saved resource with `status: open`, `sourceResultId: R.id`, and server-derived `testCaseId`/`sourceRunId`. Reopen the detail/source and inspect the persisted Bug row and foreign-key relationship in SQLite. Then edit title/details and move `open -> in-progress`; verify the row changed, source/case/run IDs stayed fixed, current result is shown separately, and test-run totals/result state did not change.

## Rejection, pending and uncertain outcomes

1. **Client validation:** leave Title blank (then submit by keyboard). Expect no POST, first invalid field focused, `aria-invalid=true`, and its visible error referenced by `aria-describedby`; inspect DB before/after and expect no new row.
2. **Server source mismatch:** submit directly to the API with real failed source `R` but `testCaseId: null`, then with a different case ID. Each should return 400 and leave Bug rows unchanged. Also exercise a source that is no longer failed (409) and a missing result (404) if available in this fixture; neither may insert.
3. **Pending/double submit:** hold the real POST response while triggering click and keyboard submit repeatedly. Expect one POST only and disabled pending actions. Release the response; expect one persisted row and success navigation. Compare request count and DB before/after.
4. **Lost response after commit:** with a disposable local response-dropping proxy, forward one real POST to the isolated server, allow it to commit, then drop only its response. Remove/stop the proxy immediately after the observation. Expect the client to retain the original draft/source/time, show uncertainty and send no automatic second POST. Inspect SQLite for exactly one row. Run fresh, unfiltered, paginated source-result GETs followed by candidate detail GETs twice; expect the saved row to be discoverable, and selecting it to open the saved Bug without another POST. Preserve evidence of GET/POST counts and database state.
5. **No-match and failed-read paths:** when safe to simulate without changing application code, verify a failed reconciliation read leaves uncertainty and disables resubmission; a successful no-match check must also send no POST until the user explicitly chooses the duplicate-risk action. If explicitly resubmitted, record that this is a second user-authorized POST, inspect both resulting rows and report the duplicate-risk outcome accurately. No fault/proxy/test toggle may remain in the final assessed checkpoint.

## Preliminary client-only verification and review

To substantiate the PR #18 client review, I made a fresh worktree at client PR head `91b0de7d1489a5d44062ff2c043c2bd98395b05c` (PR #18, still based on `main` `120d261ec5ba7db7161ee0fd5ba1da85f29113f5`; backend PR #17 is not included). Environment: macOS 27.0, Darwin arm64, Node `v24.20.0`, pinned npm `11.19.1`, SQLite `3.53.4` using `prebuilds/darwin-arm64.node`.

| Command | Observed result |
| --- | --- |
| `npx --yes --package npm@11.19.1 npm ci` | Exit 0; added 202 packages, audited 205; npm reported 10 vulnerabilities (3 moderate, 4 high, 3 critical) and an unknown `global-ignore-file` environment-config warning. These warnings are recorded, not treated as harmless or fixed. |
| `npm run verify:sqlite` | Exit 0; native SQLite write/read passed. |
| `npm run lint` | Exit 0. |
| `npm run test -w client` | Exit 0; 11 files, 64 tests passed. |
| `npm run build` | Exit 0; Vite transformed 59 modules and built production assets. |

Raw output, environment, and tested SHA are in the ignored local archive `docs/evidence/local/2026-11-25/h2-client-review/` in the fresh client-review worktree. No backend test, browser/API journey, SQLite Bug-state inspection, screenshot, or whole-project `npm test` was performed at this pre-integration checkpoint.

I reviewed the actual PR #18 head and submitted [BK's changes-requested review at `91b0de7`](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/18#pullrequestreview-6063871333). The new status-label fix and failed-refresh-read test are present. The test still expects a successful detail refresh to unblock save while retaining stale edited fields; it does not model a PUT that committed before its response was lost. The unresolved concern is that refreshing after an uncertain PUT leaves the local draft intact and clears uncertainty, allowing a stale repeat PUT without an explicit reconciliation choice. The focused client suite passed including this test, so green tests do not resolve that finding. This review was submitted by the agent through BK's GitHub identity; it is not represented as human verification.

### Re-review of the corrected uncertain-PUT recovery

At the user's request, I re-reviewed PR #18 at `428124aa94ccce548394df8caf31768ebbbac315`. The client source at that commit is identical to the implementation tested at `1d805370fbe320a557c3220ccca663b8f8c7a479`; a source diff against current PR head `dc15c280e3169ffe01d6fe4a7892004aeea395ab` is empty. I verified the correction against the prior finding, the failed/successful-refresh component checks, the browser runner's real `PUT`-then-response-abort path, its fresh API reads and blocked-save assertions, the selected recovery screenshot, and the post-stop SQLite reopen record. The fix resolves the finding; **BK approved** at the requested SHA: [review](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/18#pullrequestreview-6069983469). This review evaluates the submitted source and author-side execution evidence; it does not replace BK's independent fresh-checkout verification. PR #18 remains open, so no merged client checkpoint is available yet.

## Evidence to capture and review

Keep raw command logs and database inspection output in the ignored local evidence archive. Publish only selected synthetic screenshots: successful saved Bug with source, uncertain/reconciliation state, and the bounded keyboard validation/focus state. In the final record, include expected vs actual for each attempted case, before/after row counts/IDs and source links, any defect or blocked check, CI/checkpoint links, MK PR/review links, and BK's own explanation and approve/request-changes decision. Attribute observations to the agent; do not present account ownership or an automated review as human verification.

## Independent integrated verification at PR #18 checkpoint

**Tested application SHA:** `2b76cd99d4244d98023bcdd3b93ab17d2e3bdd15` (PR #18 merge checkpoint). This was a filtered fresh clone in `/private/tmp/bk-h2-checkpoint`, on macOS 27.0 / Darwin arm64, Node `v24.20.0`, npm `11.19.1`. The machine-wide npm was 12.0.2, so every npm invocation used the pinned npm 11.19.1 CLI explicitly. The isolated app listened on `127.0.0.1:63621`; health returned HTTP 200 with `{ "status": "ok" }`. Its disposable database was `/var/folders/qd/svj04r_x0ss6sfjx_sbd5v5h0000gn/T/qa-baseline-isolated-g060Cm/synthetic.sqlite`. The server was stopped before opening that SQLite database directly for the final state checks. No fault hook or proxy remained running.

### Fresh setup and regression results

Commands on the fresh checkout: `npm ci`, `npm run verify:sqlite`, `npm install-scripts ls`, `npm run lint`, `npm test`, `npm run build`, `npm run smoke:h2`, and `PORT=0 npm run start:isolated` (the actual port and database path are recorded above and in the startup log). Install completed with 202 packages added and 205 audited. npm reported **10 vulnerabilities (3 moderate, 4 high, 3 critical)**; they are recorded as unresolved dependency findings, not described as harmless or fixed. `npm install-scripts ls` reported no packages with unreviewed install scripts. SQLite 3.53.4 native write/read, lint and production build passed. The full test command passed **65 client tests + 82 server tests = 147 total**, with zero failures. The H2 smoke command also passed its startup/schema, source-derived create, mismatch rejection/no-write, forbidden transition, retained source/suite deletion, changed source outcome, and SQLite reopen checks. Sandbox loopback restrictions blocked an initial attempt to run socket-based checks; the successful smoke and full test runs were then performed with loopback access enabled. No product-code changes were made for verification.

### Real browser, API and database journey

The browser run used installed Chrome and Playwright against the actual Vite client, isolated API and SQLite database. Inputs and records were synthetic. Before the journey the database held zero Bugs. The seeded source was result `2`, case `2`, run `1`, initially failed.

| Check | Expected | Observed |
| --- | --- | --- |
| Create and edit/status | One explicit create persists server-derived source/case/run identity; edit and allowed status change persist without changing source identity or run totals. | Create returned 201 and inserted Bug `#1` (`open`, source result `2`, case `2`, run `1`). Edit plus `open -> in-progress` persisted. The three run results and pass/fail/skip totals remained unchanged; source identity remained fixed. The source result was changed to passed and restored to failed: the Bug still retained its link and displayed the current source outcome separately. |
| Pending/double submit | Repeated click/Enter during pending produces one POST and disables submit. | One POST; submit was disabled until completion. |
| Rejected stale source | Rejection keeps draft and does not insert. | After changing the source from failed, create returned 409; draft title remained and Bug count stayed at one. |
| Lost create response | If the server commits but the response is lost, show uncertainty, do not retry automatically, and reconcile through fresh GETs; selecting a match must not POST again. | The real server returned 201 and committed Bug `#2`; the browser response was then dropped. The page showed unresolved outcome. A failed reconciliation GET left it unresolved. After adding 20 synthetic matching rows to force pagination, two fresh page-2 reads found the committed Bug. Choosing it did not issue another POST. |
| Lost update response | A committed PUT whose response is lost must remain uncertain until fresh saved data is inspected and explicitly adopted or overwritten. | PUT returned 200 and committed title/status `BK H2 update committed before lost response` / `resolved`; its browser response was dropped. A failed detail read kept Save blocked. A successful read showed saved state against the local draft. Choosing “Use refreshed saved version” sent no second PUT. |
| No match / explicit retry | Failed pre-commit request is reconciled; no retry until explicit user action. | First POST was aborted before reaching the server. Fresh reads found no match and no automatic retry occurred. Only after explicit duplicate-risk resubmission did exactly one Bug `#23` appear for source result `3`. |
| Keyboard validation | Enter on an empty form shows accessible validation and focuses an invalid field; bounded Tab traversal reaches the next field. | Enter focused `bug-title`; `aria-invalid=true`, `aria-describedby=error-title`, visible required-title message; next Tab focused `bug-steps`. No POST was sent. |

The server was stopped, then the database was reopened directly. Final state: 23 Bugs (including the two primary create/update/recovery records, 20 synthetic pagination fillers, and the explicit no-match retry record); source links were retained. `PRAGMA foreign_key_check` returned no rows and `PRAGMA integrity_check` returned `ok`. The disposable database was seeded fresh at schema version 1. **No historical database was migrated or migration path tested** in this run; migration compatibility remains unverified and must not be inferred from this fresh-database result.

The browser emitted one expected 409 console entry and `net::ERR_FAILED` entries from deliberately aborted response/read paths. The harness classified these controlled fault observations as expected; there were no uncaught page errors or unexpected console errors. They are not evidence of unrelated browser failures.

### Published evidence

The capture bundle at [`captures/bk-2026-11-26-h2/`](captures/bk-2026-11-26-h2/) contains environment and SHA, setup/install-script/native probe/lint/test/build/smoke/startup logs, the browser runner and structured browser results, the post-shutdown SQLite state and integrity checks, plus six selected synthetic screenshots. Key images: [saved update/source retention](captures/bk-2026-11-26-h2/saved-updated.png), [uncertain create](captures/bk-2026-11-26-h2/uncertain-post.png), [page-two reconciliation](captures/bk-2026-11-26-h2/reconciled-page-two.png), [uncertain update recovery](captures/bk-2026-11-26-h2/uncertain-put-recovery.png), [keyboard validation](captures/bk-2026-11-26-h2/keyboard-validation.png), and [explicit no-match gate](captures/bk-2026-11-26-h2/no-match-explicit-gate.png). This artifact reports only the independent run at the SHA above; the earlier PR #18 client-only results remain distinct.

**PR #19 update/review:** publish this result on the existing `codex/bk-h2-integration` branch and request MK's review again. PR #19 remains unmerged. The evidence is an agent-executed verification, not a claim of human verification or MK approval.
