# BK — H2 integration verification

**Status:** plan prepared; feature integration and independent browser/API/SQLite journey pending. Preliminary client-only checks are recorded below and are not an integrated H2 result.

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

**Still pending:** PR #18 is approved but still open. After its integration into `main`, perform a new supported-runtime setup at the resulting integrated application SHA, then the migration/journey/rejection/pending/uncertain/keyboard checks, browser screenshots and regression suite. The client-only evidence above and MK's author-side browser run must remain separate from BK's fresh independent results. Update this record only with outcomes observed at the cited SHA.
