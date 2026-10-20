# Bug API and domain contract — H1 draft

| Item | Value |
| --- | --- |
| Status | Proposal for MR's reading and EM's review; not yet agreed or implemented |
| Issue | [#1 — Define the Bug API and domain contract](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/issues/1) |
| Owner | MR (`makss-rivero`) |
| Reviewer | EM (`RS77713`) |
| Branch | `docs/mr-h1-api-contract` |
| Baseline | `part1-baseline` — `bc304f1d954cb1e55d5ec7cdd06e49bba455613e` |

The team's confirmed assignment is to define a Bug API and domain contract.
The baseline has no Bug routes or Bug table. The fields, lifecycle, endpoints,
validation limits, and relationship rules below are proposed decisions for
review, not requirements inferred from existing Bug code.

This document describes future behaviour. Its HTTP examples are illustrative;
they cannot be exercised against the unchanged baseline.

## 1. Purpose and scope

A bug records an observed defect, its severity, and its progress toward closure.
The proposed first version lets a user:

- Create a bug with a title, description, and severity.
- List, search, and filter bugs.
- View and edit a bug.
- Move a bug through an explicit lifecycle.
- Optionally link a bug to one existing test case.
- Choose "Create bug" on a failed test-run result and retain that exact result
  as the bug's source. The user reviews the form and submits it explicitly.

This proposal does not include deletion, comments, attachments, assignments to
users, notifications, or automatic bug creation from failed test runs. Closing a
bug retains its record and any source reference. These scope choices need EM's
confirmation.

## 2. Bug resource

API field names use camelCase, following the existing test-case API.

| Field | JSON type | Rule |
| --- | --- | --- |
| `id` | integer | Server-generated positive safe integer; read-only. |
| `title` | string | Required; trimmed; 1–200 Unicode code points. |
| `description` | string | Required; trimmed; 1–5,000 Unicode code points. Plain text describing reproduction steps, expected behaviour, and actual behaviour. |
| `severity` | string | Required; exactly `Critical`, `Major`, `Minor`, or `Trivial`. |
| `status` | string | Exactly `open`, `in-progress`, `resolved`, or `closed`. Created as `open`. |
| `testCaseId` | integer or `null` | Optional link for a standalone bug. For a bug created from a result, the server derives this from that result and it cannot be changed or cleared. A supplied integer must be positive and safe. |
| `sourceResultId` | integer or `null` | Optional positive safe integer identifying one `test_run_results.id`. Accepted only on creation; immutable afterwards. The result must exist and be `failed` when creation is validated. |
| `sourceRunId` | integer or `null` | Read-only run ID derived from the source result's `run_id`. Null when `sourceResultId` is null. |
| `createdAt` | string | Server-generated UTC timestamp in ISO 8601 format; read-only. |
| `updatedAt` | string | Server-generated UTC timestamp of creation or the latest successful Bug API update; read-only. |

The severity values reuse the existing test-case vocabulary. Bug titles do not
require the test-case title suffix such as `[Authentication]`. Duplicate bug
titles are allowed; the numeric ID identifies the resource.

Text is validated after trimming leading and trailing whitespace. Internal
whitespace and line breaks in the description are preserved. Blank strings,
incorrect types, invalid enum values, and overlong text are rejected.

### 2.1 Source failed execution

`testCaseId` identifies a test definition; `sourceResultId` identifies its
execution in one particular run. The client obtains the latter from a result's
`id` in `GET /api/test-runs/:runId`, not from the run's ID or the test case's ID.
The server derives `sourceRunId` and `testCaseId` from that result. The response
lets the client open the source run and select the exact result.

Standalone reporting remains valid: without a source result, a bug may have a
test-case link or no link. For every Bug response, both source fields are
present, either with their IDs or as `null`. Several bugs may reference the
same source result; the source is evidence of origin, not a deduplication key.

The source reference cannot be added, changed, or removed through `PUT`,
including for a bug initially created without a source. The existing run API
can still edit the result's outcome, duration, and notes. Such edits neither
unlink nor close the bug, and later Bug updates do not recheck that the source
is still `failed`. A new bug from that result does require it to be `failed`
at the time of the new creation.

This is a retained reference, not a frozen snapshot of the original notes or
outcome. The client must distinguish "failed when the bug was reported" from
the source result's current state. A bug's reproduction description remains
independent of later result edits. Retention and deletion rules are in section 7.

## 3. Proposed lifecycle

| State | Meaning | Allowed next states |
| --- | --- | --- |
| `open` | Reported and awaiting work. | `in-progress` |
| `in-progress` | Investigation or a fix is underway. | `open`, `resolved` |
| `resolved` | A fix is ready for verification. | `in-progress`, `closed` |
| `closed` | The fix has been verified and the bug is closed. | `open` |

Keeping the current status is valid when editing other fields. Any other
transition returns `409 Conflict` and leaves the entire bug unchanged. For
example, moving directly from `open` to `closed` is rejected.

These states describe workflow, not permissions: the baseline has no user
authentication or role model. The API does not establish who is entitled to
verify a fix.

Changing a bug's status does not change a test case's status, any test-run result,
or the dashboard's existing test execution metrics.

## 4. HTTP conventions

- All proposed routes start with `/api/bugs`.
- Development API origin: `http://localhost:3001`. The browser client uses the
  existing `/api` proxy.
- `POST` and `PUT` accept `Content-Type: application/json` with a JSON object.
- Responses use the existing `{ success, data, error }` envelope.
- Success responses have `success: true` and `error: null`.
- Failure responses have `success: false`, `data: null`, and a readable string in
  `error`.
- Clients must use the HTTP status and envelope to handle errors, rather than
  parse the wording of an error message.
- Unknown body fields, including read-only fields, are rejected with `400`.
- Numeric IDs in request bodies must be JSON numbers, not numeric strings.
  Route and query IDs must be decimal representations of positive safe integers.
- Validation and a requested change must complete atomically. A failed request
  must not partially change fields or timestamps.

## 5. Endpoints

| Method | Path | Purpose | Successful response |
| --- | --- | --- | --- |
| `POST` | `/api/bugs` | Create a bug. | `201`, with the complete Bug resource in `data`. |
| `GET` | `/api/bugs` | List matching bugs. | `200`, with a paginated collection in `data`. |
| `GET` | `/api/bugs/:id` | Retrieve one bug. | `200`, with the complete Bug resource in `data`. |
| `PUT` | `/api/bugs/:id` | Replace editable fields and optionally change status. | `200`, with the complete updated Bug resource in `data`. |

No `DELETE` or `PATCH` operation is part of this proposal.

### 5.1 Create a bug

`POST /api/bugs` requires `title`, `description`, and `severity`.
The optional `sourceResultId` and `testCaseId` follow these rules:

- With an omitted or null `sourceResultId`, the bug has no execution source.
  An omitted or null `testCaseId` means no test-case link; a supplied ID must
  identify an existing case, otherwise return `404`.
- With a non-null `sourceResultId`, the result must exist (`404` otherwise) and
  currently have `result: "failed"` (`409` otherwise, including `pending`,
  `passed`, and `skipped`). The result's own outcome matters, not the aggregate
  status of its run or the test case's current status.
- The server derives `testCaseId` from that source. The client may omit
  `testCaseId` or supply the same ID. An explicit `null` or a different ID is
  inconsistent with the source and returns `400`.
- Source validation and insertion occur in the same write transaction. If the
  result changes or is deleted before that transaction validates it, apply
  the rules above rather than create a bug with a stale source.

The client must omit `status`, `id`, `sourceRunId`, `createdAt`, and `updatedAt`.
The server sets the initial status to `open` and both timestamps to the
creation time. No bug is created merely by marking a result as failed.

Example request, assuming result `42` belongs to run `7`, references test case
`3`, and is currently `failed`. `testCaseId` is deliberately omitted so the
server derives it:

```json
{
  "title": "Login form accepts an empty password",
  "description": "Steps: open the login form and submit an empty password.\nExpected: a validation message.\nActual: the form proceeds.",
  "severity": "Major",
  "sourceResultId": 42
}
```

Example `201 Created` response:

```json
{
  "success": true,
  "data": {
    "id": 17,
    "title": "Login form accepts an empty password",
    "description": "Steps: open the login form and submit an empty password.\nExpected: a validation message.\nActual: the form proceeds.",
    "severity": "Major",
    "status": "open",
    "testCaseId": 3,
    "sourceResultId": 42,
    "sourceRunId": 7,
    "createdAt": "2026-10-20T18:00:00.000Z",
    "updatedAt": "2026-10-20T18:00:00.000Z"
  },
  "error": null
}
```

A standalone bug has `sourceResultId: null` and `sourceRunId: null`. If it is
also unlinked to a test case, it has `testCaseId: null`.

#### 5.1.1 Uncertain creation outcome and safe retry

Each accepted `POST` creates a new resource. This version has no idempotency key
or replay/deduplication guarantee, even for identical fields or the same source.
The client must not automatically retry a creation request.

1. On an explicit submission, retain the form input, source IDs, the submitted
   payload, and the submission time. Disable repeated submission while the
   request is pending so double-clicking does not send another `POST`.
2. A valid `201` envelope confirms creation; open the returned bug. A definite
   validation rejection leaves the draft available for correction. A timeout,
   connection loss, interrupted request, unreadable response, or `5xx` response
   leaves creation uncertain: the server might already have committed it.
   Preserve the draft and say that the bug may have been saved. Do not silently
   treat this as a validation rejection or reset the form. Keep resubmission
   disabled until the reconciliation checks below succeed.
3. Offer "Check existing bugs" while retaining the draft. For a source-linked
   submission, use
   `GET /api/bugs?sourceResultId=42&sort=id&order=desc&page=1` (with the actual
   source ID). For a standalone submission, start with
   `GET /api/bugs?sort=id&order=desc&page=1`. Do not add status or severity
   filters that could hide a saved bug. Follow pagination and open candidates
   with `GET /api/bugs/:id`; the first page or a title alone is not sufficient.
   Use fresh server responses; cached or offline lists do not resolve the outcome.
4. Compare candidates with the submitted title, description, severity, and links.
   For a source-linked submission, compare the selected result and its case/run
   IDs, allowing for the case ID being derived rather than sent in the payload.
   Account for server-side trimming and use creation time as a clue, not a
   unique identifier or an exact client/server clock match. If the user
   identifies the saved bug, let them open/use it without another `POST`. If
   several records are plausible, show them for inspection rather than declaring
   one to be the result of this request.
5. If the reads fail, keep the draft and the outcome unresolved; offer another
   read attempt. After successful reads and a refreshed check of the relevant
   pages, a user who finds no saved bug may explicitly choose to submit again.
   Explain that a late original request or a concurrently edited record can
   still produce a duplicate. A missing match is not proof that creation
   failed; there must be no automatic resubmission.

The original form must survive opening and returning from reconciliation.
Retries of these `GET` requests are safe because they do not create or modify
bugs; use a bounded retry or a user-operated refresh. This flow reduces accidental
duplicates but does not promise exactly-once creation. MK's client contract must
include the same uncertain-outcome state and reconciliation actions.

### 5.2 List bugs

`GET /api/bugs` supports these query parameters:

| Parameter | Default | Meaning |
| --- | --- | --- |
| `page` | `1` | Positive integer page number. The page size is fixed at 20. |
| `search` | No search | Trimmed title substring, at most 200 Unicode code points. An empty value means no search. |
| `status` | All statuses | One exact Bug status. |
| `severity` | All severities | One exact severity value. |
| `testCaseId` | All bugs | Restrict results to one positive safe integer test-case ID. |
| `sourceResultId` | All bugs | Restrict results to one positive safe integer source-result ID; supports reconciliation after uncertain creation. |
| `sort` | `id` | One of `id`, `severity`, or `updatedAt`. |
| `order` | `asc` | One of `asc` or `desc`. |

Filters are combined with AND. Invalid, repeated, or unknown parameters return
`400` rather than being silently ignored. To select all statuses or severities,
omit the parameter rather than send `all`.

Search matches ASCII letters without case sensitivity; other characters match
as stored. `%`, `_`, and backslash in search input are literal characters, not
SQL pattern controls. Severity ascending means `Critical`, `Major`, `Minor`,
then `Trivial`. Equal sort values are ordered by `id` ascending.

The response shape follows the existing test-case list:

```json
{
  "success": true,
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 1
  },
  "error": null
}
```

Each nonempty `items` entry is a complete Bug resource. `total` counts all
matching bugs before pagination; `totalPages` is
`max(1, ceil(total / 20))`. A page beyond the last page returns `200` with an
empty `items` array and the requested page number. Filtering by a well-formed
test-case or source-result ID with no matching bugs also returns an empty
collection, even if that ID does not exist.

### 5.3 Retrieve a bug

`GET /api/bugs/17` returns the resource shape shown in the create example, with
HTTP `200`. A malformed ID returns `400`; a valid ID with no bug returns `404`.

### 5.4 Update a bug

`PUT /api/bugs/:id` requires all four editable fields: `title`, `description`,
`severity`, and `status`. It is a replacement of editable fields, not a partial
update. For a standalone bug, the optional `testCaseId` is cleared when omitted
or explicitly `null`; clients retaining a link must send its current value.

For a bug with a source result, `testCaseId` must be included with the existing
source's test-case ID. Omitting it, clearing it, or requesting a different case
returns `409` and leaves the entire bug unchanged. Malformed field types still
return `400`. `sourceResultId` is create-only and `sourceRunId` is read-only:
including either in a `PUT` body returns `400`, even with its current value.
Omitting these source fields preserves them.

For example, this request moves the bug from `open` to `in-progress`:

```json
{
  "title": "Login form accepts an empty password",
  "description": "Steps: open the login form and submit an empty password.\nExpected: a validation message.\nActual: the form proceeds.",
  "severity": "Major",
  "status": "in-progress",
  "testCaseId": 3
}
```

The server validates the current-to-requested status transition and the
test-case/source consistency rules before saving. It does not require a
retained source to remain failed. `id`, `sourceResultId`, `sourceRunId`, and
`createdAt` remain unchanged; `updatedAt` is set to the server's current time
on every successful update, including an otherwise identical replacement.

This version has no version field or conditional-update mechanism. Concurrent
valid edits use the last accepted write; conflict detection between stale
browser edits would require a later contract change. The implementation must
still validate transitions against the current stored status within the write
transaction.

## 6. Failure responses

| HTTP status | Condition |
| --- | --- |
| `400 Bad Request` | Malformed JSON, a non-object body, invalid or missing fields, unknown/read-only fields, a create-only field in `PUT`, invalid query parameters, malformed IDs, or an explicit test-case link inconsistent with the source during creation. |
| `404 Not Found` | The requested bug or creation source result does not exist, or a test-case link for a standalone bug does not exist. |
| `409 Conflict` | The creation source is not currently failed, a Bug update would change/clear a source-derived test-case link, or a status transition is forbidden. The suite-deletion integration in section 7 also uses `409` when it would remove a referenced result. |
| `413 Content Too Large` | The request exceeds the existing JSON middleware's payload limit. |
| `415 Unsupported Media Type` | A create/update request is not sent as JSON. |
| `500 Internal Server Error` | An unexpected server or database failure. |

These failure responses must use the envelope, including errors from JSON
parsing. Unexpected failures return `internal server error` rather than database
details. These requirements apply to the proposed Bug API; they do not claim
that every existing route already handles these cases. The suite-deletion
requirement in section 7 is a specific future integration change.

Example validation failure:

```json
{
  "success": false,
  "data": null,
  "error": "title is required"
}
```

Example forbidden transition:

```json
{
  "success": false,
  "data": null,
  "error": "cannot change bug status from open to closed"
}
```

If several problems are present, clients must handle the status returned without
depending on a specific ordering of validation messages.

## 7. Persistence and relationships

The proposed SQLite table is `bugs`. The following is design SQL, not a migration
executed by this documentation change:

```sql
CREATE TABLE bugs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 5000),
  severity TEXT NOT NULL
    CHECK (severity IN ('Critical', 'Major', 'Minor', 'Trivial')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in-progress', 'resolved', 'closed')),
  test_case_id INTEGER REFERENCES test_cases(id) ON DELETE SET NULL,
  source_result_id INTEGER REFERENCES test_run_results(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (source_result_id IS NULL OR test_case_id IS NOT NULL)
);

CREATE INDEX idx_bugs_test_case_id ON bugs(test_case_id);
CREATE INDEX idx_bugs_source_result_id ON bugs(source_result_id);
```

The API validates and trims text before writing; SQL constraints provide a
second check on lengths and enum values. Application logic enforces allowed
status transitions, source immutability, failed-at-creation validation, and
equality between a source result's case and the bug's `test_case_id`. A foreign
key alone does not enforce those cross-field rules.

Map `test_case_id`, `source_result_id`, `created_at`, and `updated_at` to
`testCaseId`, `sourceResultId`, `createdAt`, and `updatedAt` in JSON. Obtain
`sourceRunId` by joining the source result's `run_id`; do not store a second,
potentially inconsistent run ID on the bug. A left join includes standalone
bugs with null source fields.

One test case can be linked to many bugs; each bug can link to at most one test
case. A standalone link is optional because a defect can be reported before a
test case exists. One result can be the source of several bugs; there is no
uniqueness constraint on `source_result_id`.

If an existing test case is deleted successfully, its standalone linked bugs
remain and their `testCaseId` becomes `null`. This automatic unlink does not
change the Bug API's `updatedAt` value. Existing restrictions still apply: the
baseline rejects deletion of a case referenced by test-run results. The new link
must not bypass that restriction. A source-linked bug's case therefore cannot
be deleted or automatically unlinked.

`ON DELETE RESTRICT` retains the source result for the lifetime of the bug,
including after closure. It also prevents deletion of the source run or its
suite through the baseline's cascading foreign keys. This matters because the
existing `DELETE /api/suites/:id` otherwise cascades through `test_runs_v2` to
`test_run_results`. The future implementation must catch this restriction and
return `409` with the existing failure envelope, explaining that a bug retains
the run history. The suite, its membership, runs, results, and bugs must remain
unchanged; it must not delete some rows before rejecting the operation.

There is no baseline HTTP endpoint for deleting a run or result directly. A
direct database deletion must also be blocked by the foreign key. Any later
deletion API must respect this retention rule. Deleting a suite with no
bug-referenced results keeps the baseline behaviour. Changing a result's
outcome or notes remains permitted; changing its identity, run, or case to
reinterpret a bug's source is not permitted.

Neither link copies or freezes test-case content or result notes. Editing a
test case or result does not rewrite bug descriptions, source references, or
Bug timestamps. Creating or updating a bug does not modify test cases, suites,
or run results.

Future implementation must add the table without dropping inherited data, keep
foreign-key enforcement enabled, and use bound SQL parameters. Sort columns and
directions must come from an allowlist. Choosing a migration mechanism belongs
to the implementation work.

## 8. Acceptance scenarios for future implementation

These are proposed tests to implement alongside the feature. The existing
baseline tests do not verify an unimplemented Bug API.

| Scenario | Expected result |
| --- | --- |
| Create a valid standalone bug with or without a test-case link | `201`; status `open`; both source fields are null; persistence survives reopening the database. |
| Explicitly create from failed result `42` of run `7` and case `3` | `201`; source IDs `42` and `7`, derived `testCaseId: 3`, generated ID/timestamps; the same IDs survive reopening the database and appear in create/detail/list/update responses. |
| Merely mark a test-run result as failed | No automatic Bug creation. |
| Create bugs from two different failed results of the same test case | Each retains its own source-result and run IDs, not just the common case ID. |
| Supply a malformed or nonexistent source-result ID | `400` for an invalid type/value, `404` for a well-formed nonexistent ID; no bug inserted. Omitted/null remains a valid standalone request. |
| Create from a pending, passed, or skipped result, including one changed before creation validates it | `409`; no bug inserted, regardless of aggregate run or test-case status. |
| Source is deleted before the creation transaction validates it | `404`; no bug inserted. |
| Send a null or mismatched `testCaseId` alongside a creation source | `400`; no bug inserted. Omitting the case or sending its matching ID succeeds. |
| Submit blank, missing, overlong, or incorrectly typed fields | `400`; no row or partial update. |
| Supply a read-only or unknown field | `400`; no change. |
| Retrieve an existing, missing, or malformed bug ID | `200`, `404`, or `400`, respectively. |
| Filter, search, sort, or paginate | Correct items and totals; stable ordering; literal search characters; invalid parameters rejected. |
| Request a page with no matches | `200`; empty items; documented pagination metadata. |
| Edit fields while retaining status | `200`; creation time preserved; update time refreshed. |
| Exercise each allowed lifecycle transition | `200`; stored status matches the requested state. |
| Attempt a forbidden transition while editing other fields | `409`; every field and timestamp remains unchanged. |
| Link a standalone bug to a nonexistent test case | `404`; no bug creation/update. |
| Clear a standalone link with `null` or omitted `testCaseId` on update | `200`; response and database contain a null link. |
| Send either source field on update, including to attach a source to a standalone bug | `400`; no fields or timestamps change. |
| Omit, clear, or change a source-linked bug's `testCaseId` on update | `409`; no fields or timestamps change. |
| Change a source result to passed or edit its notes, then edit the bug | Existing source and Bug timestamps survive the result edit; a valid Bug edit still succeeds without rechecking failure, and only then refreshes `updatedAt`. Source details show the current result, not a frozen snapshot. |
| Delete a test case when baseline rules permit it | Bug retained; link becomes null; Bug API update timestamp preserved. |
| Delete a test case referenced by run results | Existing rejection remains; linked bugs and run history remain intact. |
| Delete a suite containing a source result, even after its bug is closed | `409` envelope; no suite, membership, run, result, or bug is deleted. |
| Delete a referenced result or its run directly in SQLite | Foreign-key rejection; source and bug retained. |
| Delete a suite whose results are not referenced by bugs | Existing deletion behaviour remains. |
| Send malformed JSON, a non-JSON request, or an oversized body | `400`, `415`, or `413`, respectively, with the failure envelope. |
| Change a bug's status | Existing test-case statuses, run results, and dashboard metrics remain unchanged. |
| Click submit repeatedly while creation is pending | One outgoing `POST`; draft retained until the outcome is known. |
| Server commits bug `17`, but the creation response is lost | No automatic second `POST`; draft retained; reconciliation `GET`s find the saved record and let the user open bug `17`. |
| Reconciliation reads fail or return multiple plausible matches | Draft and uncertain state retained; reads can be retried, candidates inspected; no automatic `POST`. |
| Saved candidate is on a later page or was created without a source | Reconciliation follows pages and uses detail reads; no first-page-only or title-only claim that creation failed. |
| Original creation did not save, and successful refreshed reads find no match | User may explicitly submit again after checking; draft is reused with a duplicate-risk explanation, not an exactly-once claim. |
| Deliberately submit two valid creations with the same title and source | Two resources may be created; neither titles nor source IDs deduplicate requests. |

## 9. Decisions to review before implementation

- [ ] EM and MR confirm the proposed fields and validation limits.
- [ ] EM and MK confirm that the four-state lifecycle and allowed transitions fit
  the intended interface, including reopening.
- [ ] EM and MR confirm create-only `sourceResultId`, derived case/run IDs, and
  the failed-at-creation rule. A source is a retained reference; it does not
  freeze result notes or prevent later outcome edits.
- [ ] The team confirms standalone test-case unlinking and the restriction on
  deleting results, runs, or suites whose history is referenced by a bug.
- [ ] The team confirms that closure is sufficient for the first version and that
  deletion, assignments, and history tracking can remain outside this contract.
- [ ] MK confirms the complete `PUT` payload, list parameters, and response shapes.
- [ ] MK aligns the failed-result "Create bug" action and the no-automatic-POST
  retry/reconciliation flow with this contract, including preserving the draft.
- [ ] BK confirms the proposed acceptance scenarios are sufficient for the agreed
  scope.

Unchecked items are review decisions, not approvals. Revise this draft when the
team supplies more detailed requirements.

## 10. References and AI assistance

Baseline sources used to make this proposal compatible with the project:

- [README](../../README.md): setup, application scope, and contribution workflow.
- [Part I baseline](../baseline.md): Bug management is outside the inherited scope.
- [API entry point](../../server/app.js): route mounting and response/error conventions.
- [Test-case routes](../../server/routes/test-cases.js): severity vocabulary,
  resource mapping, pagination shape, and deletion restrictions.
- [Test-run routes](../../server/routes/test-runs.js): result IDs, run/case
  relationships, and the mutable outcome, duration, and notes.
- [Suite routes](../../server/routes/suites.js): the existing suite deletion
  operation whose cascading effects need a source-retention response.
- [Database schema](../../server/db.js): SQLite conventions and existing relationships.
- [Client API helper](../../client/src/api/test-cases.js): how the client consumes
  the response envelope.

Review and verification context:

- [EM's requested-changes review on PR #3](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/3#pullrequestreview-5589588533):
  source failed-execution retention and safe creation retry are addressed by
  this revision; they still need human review.
- [Baseline readiness evidence task #2](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/issues/2):
  keep the installation/audit findings reported in PR #3 with the baseline
  reproduction evidence. EM did not independently verify those vulnerability
  counts in the contract review. This documentation change does not remediate
  dependencies or establish their current audit status.

AI assistance: Codex inspected these sources and helped draft the proposed
contract and review revisions, examples, and acceptance scenarios. This does
not establish human approval or implementation correctness. MR must read and
be able to explain the proposal; EM reviews it through the team's agreed
process. Record substantive review decisions in issue #1 or the pull request.
