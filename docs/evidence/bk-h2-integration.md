# BK — H2 integration verification

**Status:** plan prepared; feature integration and independent browser/API/SQLite run pending. No H2 journey below is reported as executed.

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

## Evidence to capture and review

Keep raw command logs and database inspection output in the ignored local evidence archive. Publish only selected synthetic screenshots: successful saved Bug with source, uncertain/reconciliation state, and the bounded keyboard validation/focus state. In the final record, include expected vs actual for each attempted case, before/after row counts/IDs and source links, any defect or blocked check, CI/checkpoint links, MK PR/review links, and BK's own explanation and approve/request-changes decision. Attribute observations to the agent; do not present account ownership or an automated review as human verification.

**Not yet run:** fresh runtime installation, migration/journey/failure checks, browser screenshots, integrated regression suite, and substantive review of MK's final PR head. Update this record only with outcomes observed at the cited SHA.
