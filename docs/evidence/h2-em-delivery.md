# EM — H2 delivery and backend review

Owner: E.Mihailovskis (`RS77713`). Reviewer: MR (`makss-rivero`).
Base main: `47848ee8ca23450eb85f90849eca1cbaa95d48ae`.
**Status:** delivery approved by MR in [review 6069479000](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/20#pullrequestreview-6069479000) and merged. EM's explanation confirmation is recorded below; final H2 index assessment remains pending.

## Contribution and rationale

Add a bounded `npm run smoke:h2` command and execute it in the existing ordinary-tool CI after build. It uses the real application, inherited fixture APIs and SQLite rather than mocked success responses. Reuse Node 24/npm 11.19.1/lockfile/native-probe setup and the existing isolated launcher. Clarify explicit non-secret env-file loading and publish the draft [H2 evidence index](H2.md).

The script selects an owned temporary database before importing application code, binds IPv4 loopback on an OS-selected port, creates a synthetic failed execution and explicitly reports a Bug. It checks seven normal/error/persistence outcomes, closes database/server handles and removes only its own database file/sidecars and empty directory. It does not expose a long-running service or migrate the user's working database. A five-second request deadline bounds each HTTP check.

## Substantive review of another member's work

[EM's backend review](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/17#pullrequestreview-6065098410) assesses MR's `f41640dd0250288e4bc23f33eae55600f9a577c8` against H1: additive migration/rollback/older data, strict validation and envelopes, atomic source validation, lifecycle, immutable identity and retained deletion boundaries.

On this Windows Node 24 environment, all 82 server checks passed, including the 22 new Bug/migration tests. A separate synthetic real HTTP/SQLite probe also checked distinct result/run/case identities 4/2/6, atomic rejected writes, closure retention, later source edits and reopening persistence. Backend CI passed and the exact reviewed head merged via PR #17 at the base main SHA above. No blocking backend issue was found within that scope; client/browser integration remains separate.

## Reproducible command and actual observations

Use the [README](../../README.md) setup and command. The recorded delivery invocation used:
`npx --yes --package npm@11.19.1 npm run smoke:h2`.

| Synthetic operation | Expected | Observed |
| --- | --- | --- |
| Start real app and migrated database | 127.0.0.1, health 200, schema 1 | Passed |
| Create/read a Bug from an explicitly failed result | 201/open; derive result/run/case 4/2/6; GET agrees | Passed |
| Explicit null case with a source | 400; all table rows unchanged | Passed |
| Open directly to closed | 409; fields/timestamps unchanged | Passed |
| Valid lifecycle then delete retained suite after closure | Updates succeed; suite DELETE 409, all rows unchanged | Passed |
| Change source outcome to passed; create another bug from it | Existing Bug retains source, result update succeeds; new creation 409 without insertion | Passed |
| Stop and reopen SQLite | Closed Bug and original identity persist | Passed |

[Exact smoke output](captures/em-h2-2026-11-25/smoke.txt),
[82-test backend regression output](captures/em-h2-2026-11-25/server-tests.txt)
and [environment/command record](captures/em-h2-2026-11-25/verification.json).
Workspace paths in the published server log are redacted; the synthetic unrelated-failure stack belongs to a passing negative test, not a production error.

Node v24.21.0, win32-x64, npm 11.19.1; existing dependencies, no clean install during EM's check. A separate inherited-configuration check pointed DB_PATH/TEST_DB_PATH at two plain-text synthetic sentinels while requesting a wildcard host/different port. Smoke exit was 0 and both sentinel hashes stayed unchanged. The final startup-ordering recheck also passed. No dependency versions or lockfile changed.

CI retains install/native/lint/tests/build and adds this command. Its checks and the review identify the exact delivery revision; the base main SHA above is not a claim that an uncommitted diff already existed at that SHA.

## Explanation, review scope and remaining work

The smoke result demonstrates that the new API persists and retains the right failed execution and that selected rejected operations leave state unchanged. It is a small environment/integration check, not comprehensive requirement coverage. A successful API probe does not establish client draft/retry correctness, keyboard behaviour, an independently reproduced fresh environment or security.

Implementation, command execution and source review were assisted on EM's workspace at EM's request. MR approved this delivery revision at `749e5d13f68460d58279a294c20174b5a98ff07b`; his review reports a separate fresh Mac setup and smoke/failure/cleanup checks. BK subsequently executed the fresh integrated client/API/SQLite journey at `2b76cd99d4244d98023bcdd3b93ab17d2e3bdd15`, and MK approved the submitted verification evidence in [review 6078036256](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/19#pullrequestreview-6078036256). These outcomes supersede the historical pending tasks, not the explicit assistance/observation limits. See [the updated index](H2.md) for remaining personal-confirmation and final-review scope. Dependency gate #11 and H1 provenance limits remain in force.

## EM's confirmed explanation review — 2026-11-26

EM explicitly confirmed reviewing and understanding the explanation that the smoke command uses real API requests and a separate temporary SQLite database to check Bug creation, rejected writes without state changes, source retention and persistence. EM also confirmed the stated limits: this command does not establish browser/keyboard behaviour or dependency security. This records adoption of the assisted explanation, not a new manual terminal run, independent inspection of every raw file or an unaided answer. Final individual assessment remains for the reviewer/instructor within that actual scope; no repeated confirmation is needed for these unchanged facts.
