# H3 verification and early-release plan

Date: 2026-11-28. Owner: EM (`RS77713`). Planned reviewer: MR (`makss-rivero`). Status: proposed plan; no H3 execution or release claimed.

Coordination: [H3 work item #24](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/issues/24).

## Basis and bounded scope

The full lecturer brief, **H3 — Verified Early Release**, was supplied on 2026-11-28. It requires representative equivalence classes and a boundary, independent expected outcomes, focused checks, structural evidence with an explained gap, one executed sensitivity check, and a clean usable early release exercised by a user or disclosed proxy. Team maximum is 6.00 points and individual maximum 4.00; no grade is claimed. M3/L7–L9/W3 completion is outside repository verification.

The local complete brief has SHA-256 `3D8936D7958C0E0C4FB57EE89E94F24B06617CAB446F1D087A9699465A45E7B1`. The local source excludes the pasted course-page account/navigation text. The brief says: “Retain H1 criteria and baseline; do not change the oracle merely to fit current output.”

- Start from H2 main **`5e913ec3eaa68074d679614d4ffda990a44766ee`**; [H2 evidence](../evidence/H2.md).
- Retain `part1-baseline` -> `bc304f1d954cb1e55d5ec7cdd06e49bba455613e` and [H1 R1–R8 criteria](../h1/architecture-decision.md#verification-expectations-and-traceability), [API contract](../h1/bug-api-contract.md), and [client contract](../h1/client-behaviour.md).
- Verify the existing Bug creation, source retention, read/update and uncertain-outcome recovery increment. Keep Reports, Settings, Flaky Tests and unrelated features outside this release.
- Reuse the real HTTP/SQLite [smoke](../../scripts/smoke-h2.mjs), H2 regression tests and actual browser evidence; add focused checks only for justified gaps. An H3 evidence matrix extends those records rather than inventing a second smoke programme.

## Functional oracles and traceability

Expected results below come from the contracts. Tests must not import production transition maps or validators to calculate their expected answers. Capture independently observed resource/state/counts before and after rejected writes. Mocked client checks do not establish real persistence.

| ID / criteria | Representative class or boundary | Independent expected result | Existing check to reuse / H3 action | Owner |
| --- | --- | --- | --- | --- |
| F1 / R1 | Open form; explicitly submit valid failed-source Bug | Opening sends no POST. Submit returns 201, derives source case/run identity and persists one Bug. | `BugWorkflow.test.jsx` opening/pending tests; `bugs.test.js` source-creation test; smoke plus retained real journey. | MK + MR |
| F2 / R2 | Blank/valid/overlong title; 1/200/201 code points; assembled description at 5,000/5,001 including labels and Unicode | Client rejects invalid form without POST; server rejects invalid direct write with 400 and no data change. Boundary-valid input is accepted. | Existing Unicode/input tests; map exact fixtures/assertions and add only a missing meaningful class. | MK + MR |
| F3 / R3 | Failed source; missing/nonfailed source; explicit null or different case ID | Valid linked creation derives identity; missing -> 404, nonfailed -> 409, explicit case mismatch -> 400; rejected create adds nothing. Later source outcome changes retain prior Bug identity. | Backend source/race tests, smoke, H2 real rejection and BK bounded mismatch record. | MR |
| F4 / R4 | Pending submit, committed POST with lost response, failed reconciliation, later-page matches, no identified match | No automatic repeat POST; draft/attempt retained; safe fresh GETs inspect candidates; identification sends no POST. Only explicit duplicate-risk resubmission may write again. No exactly-once guarantee. | Client transport/workflow checks and H2 real journey. Inspect async source-read/route changes as a candidate focused gap. | MK |
| F5 / R5 | Valid/forbidden status transition, same state, incomplete PUT; committed PUT response lost | Allowed update persists; forbidden transition -> 409 with all fields/timestamps unchanged. Complete PUT preserves immutable origin. Uncertain Save stays blocked until explicit recovery decision. Run results/totals unchanged by Bug edit. | Existing exhaustive lifecycle and complete-PUT tests, client adoption/overwrite tests; independently read rows/state. | MR + MK |
| F6 / R6 | Retained source while Bug open/closed versus unreferenced suite | Retained deletion -> 409 atomically; referenced SQL deletes blocked; unreferenced suite still deletes. | Existing retention/unreferenced/error-classification tests; retain fixture versus real-data distinction. | MR |
| F7 / R7 | Fresh schema, earlier-schema fixture, repeat startup, failed/unsupported migration | Version/DDL upgrade atomic; inherited IDs/rows preserved; failed/unsupported startup stops safely. | Existing migration tests and smoke; do not label synthetic fixture as actual historical-database validation. | MR |
| F8 / R8 | Empty-form Enter, selected-result focus, loading/error/source navigation | Correct error association/focus; no invalid write; selected result eventually receives focus; explicit recovery navigation retains draft. | Existing component checks, reviewed focus wait and bounded browser observation. | MK |

### Small lifecycle decision table

This table is an independent subset of the API lifecycle contract, not copied at runtime from `NEXT_STATUS`.

| Current | Requested | Expected |
| --- | --- | --- |
| open | open | 200, valid editable fields may persist |
| open | in-progress | 200 |
| open | closed | 409; exact stored fields/timestamps unchanged |
| in-progress | resolved | 200 |
| resolved | closed | 200 |
| closed | open | 200 |
| closed | resolved | 409; exact stored fields/timestamps unchanged |

## Structural evidence and focused additions

MR inspects `server/bugs.js`, Bug HTTP error translation, retained-suite deletion and additive migration. Node 24's installed help confirms built-in test coverage is available: start with `node --experimental-test-coverage --test server/test/bugs.test.js`, adding the existing migration test command when interpreting that module. Save actual tested SHA, command/exit/report, checked decisions and one material unchecked path with rationale. Do not invent percentages or treat aggregate coverage as proof of correctness.

MK inspects `client/src/pages/BugCreatePage.jsx`, `BugDetailPage.jsx`, `api/bugs.js` and shared validation/draft handling. The current lock/install has no `@vitest/coverage-v8` or Istanbul provider. If it remains unavailable, document this limitation and provide a reviewed path map with exact source decisions, triggering tests and uncovered alternatives as allowed by the brief. A narrowly scoped matching provider may instead be proposed with MR coordinating lockfile changes. No arbitrary coverage target applies.

Candidate focused addition: navigate/change source while a source GET is pending, resolve the old request late, and assert that stale data cannot enable submission against the wrong route/source. First inspect existing checks; do not duplicate an already-covered case. Derive expected source identity and no-write behaviour from R1/R3/R4 rather than current implementation. Diagnose any real mismatch, retain its regression and review the fix separately. A new defect is not mandatory.

## One executed sensitivity challenge

BK owns the experiment; MK reviews the actual evidence. Use a disposable checkout based on the exact reviewed candidate and a temporary synthetic database.

1. Before seeding any fault, run the focused `every lifecycle edge validates the stored state and failed edits preserve all fields and timestamps` test and capture its actual pass/fail/exit. Stop and diagnose a failing clean baseline.
2. In that disposable checkout only, introduce one documented fault: allow `open -> closed` in `server/bugs.js` while leaving requirement expectations/tests unchanged. Predicted challenge: the independent 409/no-change expectation should detect an incorrectly accepted transition. This is a hypothesis until executed.
3. Run the identical focused command, e.g. `node --test --test-name-pattern '^every lifecycle edge validates the stored state and failed edits preserve all fields and timestamps$' server/test/bugs.test.js`. Preserve actual output/exit, patch, clean/mutated identity and the specific assertion. Explain detection or survival against the oracle; infrastructure failure alone is not a killed mutation.
4. Restore the clean source, run the same check again and record exact source/diff identity. The fault must never be merged/tagged in the release. Retain the patch only as labelled experiment evidence.

An existing reproducible domain fail/pass regression may replace this experiment if it genuinely challenges the oracle and provides equivalent executed evidence. The H2 focus-test timing failure alone does not establish domain sensitivity. One justified executed challenge is enough; no surviving mutation or duplicate experiment is required.

## Ownership, independent review and order

| Member | Substantive artifact | Reviewer | Evidence |
| --- | --- | --- | --- |
| EM | This oracle/release plan, CI/integration, clean release notes/tag/checkpoint and H3 index | MR | Requirement/source rationale, reviewed plan, CI/release links and actual verification/decision |
| MR | Backend functional/structural evidence and focused issue #11 dependency repair/disposition | EM; BK independently verifies repaired environment | Expected/actual matrix, native/backend results, branch report/path diagnosis and dated full/production audits |
| MK | Client focused checks and structural reasoning | BK | Criteria-linked assertions, commands/results, path/coverage interpretation and limitations |
| BK | Executed sensitivity record and independent release-candidate verification | MK | Clean/challenged/restored outcomes, source cleanliness and independent environment/results |

Start MR and MK preparation in parallel after plan review; MR coordinates manifest/lock changes so client work avoids conflicting dependency edits. BK prepares independently and executes sensitivity after the tested target is agreed. Each author creates a focused issue/branch/PR, records actual checks and obtains the assigned substantive review. Each member's record must distinguish their actual inspection/decision/explanation from agent execution. Capture this during H3 work; do not fabricate or retroactively relabel H2 activity.

## Release and feedback gate

1. Resolve/review the existing [dependency issue #11](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/issues/11) disposition before H3 release acceptance: actual dated full/production audits, relevant repair/regressions, all remaining findings and trust-boundary decision. Do not force-upgrade blindly or call old advisory counts current. Continue isolated loopback/synthetic-data use pending that decision.
2. Integrate reviewed functional/structural/sensitivity evidence. Run the existing pinned-Node/npm native probe, lint, full suite, build and smoke on the exact clean candidate. Record actual totals, exits and CI; do not preserve 147 as a permanent target if focused checks add tests.
3. EM verifies no challenge patch/fault remains; compare release runtime to reviewed source and retain the check. Select an unused annotated early-release tag, provisionally `v0.2.0`, and resolve it to the clean SHA. Release notes distinguish inherited Part I, new H2 Bug behaviour, H3 tests/repairs, setup/use and known limits. No tag or release exists by virtue of this plan.
4. A real user representative or explicitly named peer/instructor proxy exercises the tagged increment on synthetic data. Record their actual task, observed result and feedback. An AI-generated response is not user feedback. Select one bounded improvement with before/after acceptance expectations and open the H4 feedback issue; do not pre-invent its content.
5. Final short [H3 index](../evidence/H3.md) links tag/SHA, requirement/test issues, PR/reviews, structural and sensitivity commands/results, clean release CI, proxy acceptance/H4 issue and each member's actual contribution/review/verification/explanation. Submit one repository URL in Moodle and retain actual receipt/status. No ZIP, new hosting or additional feature is required.

## Completion state

Only a proposed plan and H3 index skeleton are prepared at this revision. Focused H3 tests, structural results, actual sensitivity, dependency disposition, clean release, human/proxy acceptance and H4 feedback remain pending. Existing H2 green checks are context, not unexecuted H3 results.
