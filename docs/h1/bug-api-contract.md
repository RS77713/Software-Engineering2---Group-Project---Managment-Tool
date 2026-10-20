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

This proposal does not include deletion, comments, attachments, assignments to
users, notifications, or automatic bug creation from failed test runs. Closing a
bug retains its record. These scope choices need EM's confirmation.

## 2. Bug resource

API field names use camelCase, following the existing test-case API.

| Field | JSON type | Rule |
| --- | --- | --- |
| `id` | integer | Server-generated positive safe integer; read-only. |
| `title` | string | Required; trimmed; 1–200 Unicode code points. |
| `description` | string | Required; trimmed; 1–5,000 Unicode code points. Plain text describing reproduction steps, expected behaviour, and actual behaviour. |
| `severity` | string | Required; exactly `Critical`, `Major`, `Minor`, or `Trivial`. |
| `status` | string | Exactly `open`, `in-progress`, `resolved`, or `closed`. Created as `open`. |
| `testCaseId` | integer or `null` | Optional link to an existing test case. A supplied integer must be positive and safe. |
| `createdAt` | string | Server-generated UTC timestamp in ISO 8601 format; read-only. |
| `updatedAt` | string | Server-generated UTC timestamp of creation or the latest successful Bug API update; read-only. |

The severity values reuse the existing test-case vocabulary. Bug titles do not
require the test-case title suffix such as `[Authentication]`. Duplicate bug
titles are allowed; the numeric ID identifies the resource.

Text is validated after trimming leading and trailing whitespace. Internal
whitespace and line breaks in the description are preserved. Blank strings,
incorrect types, invalid enum values, and overlong text are rejected.

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
`testCaseId` is optional; omission or `null` means no link.

The client must omit `status`, `id`, `createdAt`, and `updatedAt`. The server sets
the initial status to `open` and both timestamps to the creation time.

Example request, assuming test case `3` exists:

```json
{
  "title": "Login form accepts an empty password",
  "description": "Steps: open the login form and submit an empty password.\nExpected: a validation message.\nActual: the form proceeds.",
  "severity": "Major",
  "testCaseId": 3
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
    "createdAt": "2026-10-20T18:00:00.000Z",
    "updatedAt": "2026-10-20T18:00:00.000Z"
  },
  "error": null
}
```

An unlinked bug has `testCaseId: null` in its response. A supplied test-case ID
that does not exist returns `404`; no bug is inserted.

### 5.2 List bugs

`GET /api/bugs` supports these query parameters:

| Parameter | Default | Meaning |
| --- | --- | --- |
| `page` | `1` | Positive integer page number. The page size is fixed at 20. |
| `search` | No search | Trimmed title substring, at most 200 Unicode code points. An empty value means no search. |
| `status` | All statuses | One exact Bug status. |
| `severity` | All severities | One exact severity value. |
| `testCaseId` | All bugs | Restrict results to one positive safe integer test-case ID. |
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
test-case ID with no matching bugs also returns an empty collection.

### 5.3 Retrieve a bug

`GET /api/bugs/17` returns the resource shape shown in the create example, with
HTTP `200`. A malformed ID returns `400`; a valid ID with no bug returns `404`.

### 5.4 Update a bug

`PUT /api/bugs/:id` requires all four editable fields: `title`, `description`,
`severity`, and `status`. It is a replacement of editable fields, not a partial
update. The optional `testCaseId` is cleared when omitted or explicitly `null`.
Clients retaining a link must send its current value.

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

The server validates the current-to-requested status transition and the optional
test-case link before saving. `id` and `createdAt` remain unchanged; `updatedAt`
is set to the server's current time on every successful update, including an
otherwise identical replacement.

This version has no version field or conditional-update mechanism. Concurrent
valid edits use the last accepted write; conflict detection between stale
browser edits would require a later contract change. The implementation must
still validate transitions against the current stored status within the write
transaction.

## 6. Failure responses

| HTTP status | Condition |
| --- | --- |
| `400 Bad Request` | Malformed JSON, a non-object body, invalid or missing fields, unknown fields, invalid query parameters, or a malformed ID. |
| `404 Not Found` | The requested bug does not exist, or a test-case link supplied during creation/update does not exist. |
| `409 Conflict` | The requested status change is not allowed from the current stored status. |
| `413 Content Too Large` | The request exceeds the existing JSON middleware's payload limit. |
| `415 Unsupported Media Type` | A create/update request is not sent as JSON. |
| `500 Internal Server Error` | An unexpected server or database failure. |

These failure responses must use the envelope, including errors from JSON
parsing. Unexpected failures return `internal server error` rather than database
details. These requirements apply to the proposed Bug API; they do not claim
that every existing route already handles these cases.

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
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_bugs_test_case_id ON bugs(test_case_id);
```

The API validates and trims text before writing; SQL constraints provide a
second check on lengths and enum values. Application logic enforces allowed
status transitions. Map `test_case_id`, `created_at`, and `updated_at` to
`testCaseId`, `createdAt`, and `updatedAt` in JSON.

One test case can be linked to many bugs; each bug can link to at most one test
case. A link is optional because a defect can be reported before a test case
exists.

If an existing test case is deleted successfully, its linked bugs remain and
their `testCaseId` becomes `null`. This automatic unlink does not change the
Bug API's `updatedAt` value. Existing restrictions still apply: the baseline
rejects deletion of a case referenced by test-run results. The new link must
not bypass that restriction.

The link does not copy or freeze test-case content. Editing a test case does not
rewrite bug descriptions. Creating or updating a bug does not modify test cases,
suites, or run results.

Future implementation must add the table without dropping inherited data, keep
foreign-key enforcement enabled, and use bound SQL parameters. Sort columns and
directions must come from an allowlist. Choosing a migration mechanism belongs
to the implementation work.

## 8. Acceptance scenarios for future implementation

These are proposed tests to implement alongside the feature. The existing
baseline tests do not verify an unimplemented Bug API.

| Scenario | Expected result |
| --- | --- |
| Create a valid linked or unlinked bug | `201`; generated ID/timestamps; status `open`; persistence survives reopening the database. |
| Submit blank, missing, overlong, or incorrectly typed fields | `400`; no row or partial update. |
| Supply a read-only or unknown field | `400`; no change. |
| Retrieve an existing, missing, or malformed bug ID | `200`, `404`, or `400`, respectively. |
| Filter, search, sort, or paginate | Correct items and totals; stable ordering; literal search characters; invalid parameters rejected. |
| Request a page with no matches | `200`; empty items; documented pagination metadata. |
| Edit fields while retaining status | `200`; creation time preserved; update time refreshed. |
| Exercise each allowed lifecycle transition | `200`; stored status matches the requested state. |
| Attempt a forbidden transition while editing other fields | `409`; every field and timestamp remains unchanged. |
| Link a missing test case | `404`; no bug creation/update. |
| Clear a link with `null` or omitted `testCaseId` on update | `200`; response and database contain a null link. |
| Delete a test case when baseline rules permit it | Bug retained; link becomes null; Bug API update timestamp preserved. |
| Delete a test case referenced by run results | Existing rejection remains; linked bugs and run history remain intact. |
| Send malformed JSON, a non-JSON request, or an oversized body | `400`, `415`, or `413`, respectively, with the failure envelope. |
| Change a bug's status | Existing test-case statuses, run results, and dashboard metrics remain unchanged. |

## 9. Decisions to review before implementation

- [ ] EM and MR confirm the proposed fields and validation limits.
- [ ] EM and MK confirm that the four-state lifecycle and allowed transitions fit
  the intended interface, including reopening.
- [ ] The team confirms optional test-case linkage and preservation of bugs when
  a case is deleted. A link to a specific failed execution would be additional
  scope.
- [ ] The team confirms that closure is sufficient for the first version and that
  deletion, assignments, and history tracking can remain outside this contract.
- [ ] MK confirms the complete `PUT` payload, list parameters, and response shapes.
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
- [Database schema](../../server/db.js): SQLite conventions and existing relationships.
- [Client API helper](../../client/src/api/test-cases.js): how the client consumes
  the response envelope.

AI assistance: Codex inspected these sources and helped draft the proposed
contract, examples, and acceptance scenarios. This does not establish human
approval or implementation correctness. MR must read and be able to explain the
proposal; EM reviews it through the team's agreed process. Record substantive
review decisions in issue #1 or the pull request.
