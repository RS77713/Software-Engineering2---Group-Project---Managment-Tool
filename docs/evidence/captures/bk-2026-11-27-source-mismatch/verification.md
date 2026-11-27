# 2026-11-27 — bounded H2 source/case mismatch check

- Application checkpoint: `2b76cd99d4244d98023bcdd3b93ab17d2e3bdd15`.
- Environment: fresh checkpoint checkout, Node 24.20.0 / npm 11.19.1; isolated server on `127.0.0.1:55591`, temporary synthetic SQLite database.
- Command: `node docs/evidence/local/2026-11-27/bounded-check/check.mjs` (the linked [`check.mjs`](check.mjs)); captured raw response: [`result.json`](result.json).
- Assistance: Codex started the isolated service, sent the one synthetic request, and inspected the captured JSON response. No human-run verification is claimed.

Expected: `POST /api/bugs` with a valid failed `sourceResultId` but explicit `testCaseId: null` returns HTTP 400 and does not insert a Bug.

Observed: health was 200; the Bug list reported total 0 before the request; POST returned 400 with `testCaseId must match the source result`; the Bug list still reported total 0 after it. The bounded check passed its assertions.

Decision: this observed case matches the H1/H2 contract for rejecting a mismatched source-derived case without a database insert.

Limitations: this is one synthetic validation case on a freshly seeded schema-v1 database. It does not establish the other H2 scenarios, historical database migration behavior, or a full regression result. The server was stopped after capture.
