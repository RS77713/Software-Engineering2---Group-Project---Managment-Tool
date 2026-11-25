# H2 — MR Bug backend evidence

Date: 25 November 2026. Owner: MR (`makss-rivero`). Reviewer: EM (`RS77713`).

- Work item: [#16 — Implement Bug backend and additive database migration](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/issues/16).
- Branch: `codex/mr-h2-bug-api`.
- Base: `120d261ec5ba7db7161ee0fd5ba1da85f29113f5` (updated `main`).
- Tested implementation: [`3daf0e74bc6bd78437137b324df6e89cca9b9df7`](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/commit/3daf0e74bc6bd78437137b324df6e89cca9b9df7).
- This evidence is added after the tested commit; it changes no runtime or test code.

## Implemented behaviour and rationale

The backend implements the agreed [API contract](../h1/bug-api-contract.md),
[architecture decision](../h1/architecture-decision.md) and backend-facing parts
of the [client contract](../h1/client-behaviour.md).

`POST /api/bugs`, paginated `GET /api/bugs`, `GET /api/bugs/:id` and complete
`PUT /api/bugs/:id` use the specified resource fields, response envelopes,
validation, literal title search, filters, deterministic sorting and lifecycle.
Malformed JSON, media/size errors and malformed IDs use failure envelopes;
unexpected Bug API failures hide database details. GET responses specify
`Cache-Control: no-store` for reconciliation. Repeated valid POSTs still create
separate resources; this API does not claim exactly-once creation.

Source validation, insertion and response reads share one immediate write
transaction. Updates likewise validate the stored lifecycle/source relationship
inside the write transaction. `sourceRunId` is derived by joining the retained
result. Foreign keys prevent retained result/run/suite deletion, and a trigger
protects the retained result's identity while permitting outcome/notes edits.
Suite deletion checks retained sources under a write lock and returns `409`
without deleting anything. A small test-case deletion adjustment preserves its
existing `400` rejection: the new Bug `SET NULL`/CHECK must not turn that case
into an unexpected `500`. Unreferenced deletion behaviour is retained.

The versioned migration adds only the Bug table, indexes and source-identity
trigger. Its DDL and `user_version` change commit together; version 1 startup
is a no-op, and unsupported versions stop initialization. API length validation
counts Unicode code points after trimming. The SQL secondary checks also handle
embedded NUL, where ordinary SQLite `length(TEXT)` stops early; counting-only
hex normalization preserves UTF-8 widths without changing stored text.

## Executed verification

Environment: macOS 13.7.8 x86_64, Node **v24.22.1**, npm **11.19.1**, SQLite
**3.53.4** using the locked native `darwin-x64.node` prebuild.

| Command | Actual result | Output |
| --- | --- | --- |
| `npm ci` | Exit 0; 202 packages added. Existing audit findings remain: 3 moderate, 4 high, 3 critical. | [Install](captures/mr-h2-2026-11-25/npm-ci.txt) |
| `npm run verify:sqlite` | Exit 0; native SQLite write/read passed. | [Native probe](captures/mr-h2-2026-11-25/sqlite.txt) |
| `npm run lint` | Exit 0; existing client lint command passed. | [Lint](captures/mr-h2-2026-11-25/lint.txt) |
| `npm test` | Exit 0; **40 client + 82 server tests passed**, including 22 new server checks. | [Full test output](captures/mr-h2-2026-11-25/tests.txt) |
| `npm run build` | Exit 0; Vite production build completed. | [Build](captures/mr-h2-2026-11-25/build.txt) |
| `git diff --check` | Exit 0; no output. | [Diff check](captures/mr-h2-2026-11-25/diff-check.txt) |

The [verification record](captures/mr-h2-2026-11-25/verification.json) identifies
the tested SHA, UTC execution times, exact commands and exit codes. The captured
outputs are unedited. Installation preceded the implementation commit; dependency
manifests, lockfile and install-script policy did not change. The separate
pre-commit focused run passed all 22 checks, which also ran in `npm test` at
the recorded commit. The test output's `synthetic unrelated failure` stack is
intentional fault injection: its assertion confirms a non-retention database
error remains `500`, with unchanged data.

The new tests use unique temporary synthetic databases and loopback HTTP. The
upgrade test copies a closed database made from the independently retained
`part1-baseline` schema, compares inherited rows, IDs, schema and AUTOINCREMENT
history, then reopens the migrated database with a saved source-linked Bug.
An injected index collision verifies transactional DDL/version rollback.
Unsupported versions are checked without changing even the original file bytes.
No check opens or migrates the local working `server/data.sqlite`.

## H1 acceptance coverage and remaining limits

| Architecture expectation | Coverage in this backend change |
| --- | --- |
| R1 | Explicit creation, derived source IDs and persistence/reopen verified through API/database checks. The real browser workflow remains separate. |
| R2 | Missing/invalid input, exact code-point boundaries, non-BMP/NUL text and unchanged failed writes verified on the server. Client validation remains separate. |
| R3 | Missing/non-failed/mismatched sources verified, including a separate SQLite writer changing/deleting a source before creation validates it; later source edits preserve identity. |
| R4 | Duplicate POST semantics, source-filtered later-page reconciliation and safe GET/detail reads verified. Browser submission suppression, lost-response handling and draft preservation remain separate. |
| R5 | Every lifecycle edge, complete PUT, immutable fields, timestamps and unchanged inherited rows verified. |
| R6 | Retained-source suite `409`, direct SQL FK restrictions, closed-Bug retention and unreferenced deletion verified. |
| R7 | Earlier-data copy, fresh startup, second startup, failure rollback and unsupported versions verified. |
| R8 | Browser accessibility and interaction checks remain separate. |

Preparation used coding assistance and automated checks. This record reports
executed commands and observed results; it does not attest an unrecorded personal
reading, manual browser check or human approval. MR's personal understanding and
EM's review decisions must be recorded by the respective member. Review and
merge acceptance remain pending.

This change adds no client UI, Bug deletion, assignments, comments, authentication,
Reports, Settings or Flaky Tests. Existing data, local work and dependency files
are preserved. The [dependency gate #11](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/issues/11)
remains open; no audit upgrade was applied. Continue using the README's isolated
synthetic-data setup. Passing these checks does not establish browser integration,
shared/public deployment readiness or completion of every member's H2 work.
