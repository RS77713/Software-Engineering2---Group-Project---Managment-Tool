# MK H1 individual evidence

The focused test-run API check passed all 3 tests with exit code 0 on
2026-11-21 at 21:53 UTC. This is Codex-assisted evidence prepared for MK
(`DizzyWaters`), with BK (`bkuvshinnikov`) requested as reviewer.

## Execution record

| Item | Actual value |
| --- | --- |
| Tested application SHA | `e665be8a26e7c746c60e5680a6617766dbeb54b1` |
| Branch | `codex/mk-h1-individual-evidence` |
| Command from repository root | `node --test server/test/test-runs.test.js` |
| OS | Ubuntu 24.04.5 LTS, Linux 7.0.0-43-generic, x86_64 |
| Node / npm | `v26.12.1` / `11.20.0` |
| Dependencies | Existing `node_modules`; no installation performed |
| Exit code | `0` |
| Result | 3 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo |

[Complete command output](captures/mk-2026-11-21/test-runs.txt) and
[environment, timestamps and exit code](captures/mk-2026-11-21/environment.json)
are committed alongside this explanation. The capture is a fresh execution,
not EM's historical evidence. Only documentation is changed after the tested SHA.

## Successful operations and invalid input

The assertions in [the test file](../../server/test/test-runs.test.js) establish:

1. **Run creation and suite membership.** Two cases are linked to a suite
   (HTTP 201). Creating a run returns HTTP 201, `in-progress`, and two
   `pending` results. Linking a third case afterward leaves the existing run
   with two results. This checks membership at creation, not an immutable copy
   of every test-case field.
2. **Execution totals and completion.** Updating the first result to `passed`
   leaves the run `in-progress` with `passCount: 1`. Updating the second to
   `failed` returns HTTP 200, run status `failed`, one pass, one failure,
   and a nonempty `endTime`. Here a failed case is expected fixture data;
   the automated test itself passes.
3. **Invalid-input rejection.** Sending `result: "unknown"` to the existing
   result returns HTTP 400 and an error matching `result must be one of`.
   The route lists `passed, failed, skipped` as allowed execution values.
   The test does not assert the exact full error envelope or read back state
   after rejection, so it does not independently prove absence of mutation.

## Scope and limits

The test starts an HTTP server on an ephemeral port and uses a unique temporary
SQLite database through `TEST_DB_PATH`. Its hooks clear fixture tables and close
and remove the temporary database and sidecars. The seed messages in the raw
output are setup, not additional test results.

Node 26 is outside the declared `>=24 <25` engine range and `.nvmrc` value `24`.
This run proves the focused assertions in the recorded environment; it does not
establish reproducibility on the supported Node 24 runtime or a clean install.
It does not cover browser interaction, the full client/server suite, lint,
build, dependency security, all validation paths, or implementation of the
proposed Bug API. Those need their own evidence.

## Assistance and explanation review

Codex executed the command, captured the output and metadata, drafted this
explanation, and reviewed its claims against the test assertions and route
implementation. No human execution or personal review is inferred from the
GitHub account or the fixture's `createdBy: "MK"` value.

MK personal review of this explanation is **pending**; MK must read it and
confirm their understanding in the PR. BK independent review is **requested**,
not yet received. Neither review is represented as completed by this record.

## Saved links

The companion [PR and review link record](mk-h1-links.md) saves the published
PR, evidence, and BK review location. The PR must remain unmerged pending review.
