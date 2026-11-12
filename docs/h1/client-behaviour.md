# H1 — Client Behaviour Contract

## 1. Overview

This document describes the expected client-side behaviour for creating bug reports from failed test results in the QA Management Tool.

The purpose is to define a consistent user experience, including form validation, successful submission, error handling, duplicate prevention, and accessibility.

This document follows the proposed Bug API contract in `docs/h1/bug-api-contract.md`. It describes future behaviour, not an implemented feature; remaining team decisions still require review.

## 2. Starting Bug Creation

A tester should be able to create a bug report directly from a failed test result.

Expected workflow:

1. The tester opens a test run.
2. The tester selects a test result with the status `Failed`.
3. The interface provides a **Create Bug** action.
4. Selecting this action opens the bug creation form.
5. The form automatically associates the bug with the selected failed test result.
6. The tester enters the necessary bug details and submits the form.

If bugs already reference the result, provide access to them so the tester can check existing reports. Several bugs may reference one result; deliberately reporting another defect remains allowed. Marking a result as failed never automatically creates a bug.

Use the selected result’s `id` from `GET /api/test-runs/:runId` as `sourceResultId`, not the run ID or test-case ID. Send a positive safe integer JSON number. The result must exist and have `result: "failed"` when creation is validated; aggregate run and test-case status do not determine eligibility. A deleted source returns `404`; a source no longer failed returns `409`. Preserve the draft and ask the tester to review the source.

The server derives `testCaseId` and read-only `sourceRunId`. Omit `testCaseId` on creation, or send its matching ID; explicit `null` or a different ID returns `400`. `sourceResultId` is create-only and cannot later be added, changed, or cleared. Later outcome or notes edits do not unlink the bug or rewrite its description. Show the source’s current state separately from “failed when reported”: the reference is not a frozen snapshot.

The API also allows standalone bugs with omitted/null `sourceResultId` and an optional existing test-case link. That does not remove the source requirement for this failed-result workflow.

## 3. Required Fields and Validation

The interface must indicate which fields are required and display understandable validation messages.

Steps, Expected, and Actual are required by this client workflow and map to one API `description`; they are not separate API fields.

| Field | Validation | Error Message |
|---|---|---|
| Title | Required string, trimmed, 1–200 Unicode code points | "Enter a title of 1–200 characters." |
| Severity | Required; exactly `Critical`, `Major`, `Minor`, or `Trivial` | "Select a severity." |
| Steps to Reproduce | Required, non-empty after trimming | "Steps to reproduce are required." |
| Expected Result | Required, non-empty after trimming | "Expected result is required." |
| Actual Result | Required, non-empty after trimming | "Actual result is required." |
| Related Test Result | Positive safe integer referencing a valid failed result | "A valid failed test result is required." |
| Combined description | Required string, trimmed, 1–5,000 Unicode code points including labels and line breaks | "Reproduction details must fit within 5,000 characters." |

### Mapping reproduction fields

There is no separate required Description input. Combine the three trimmed inputs into plain text, preserving their internal whitespace and line breaks:

```text
Steps: <Steps to Reproduce>
Expected: <Expected Result>
Actual: <Actual Result>
```

Validate the entire assembled `description`, including labels and line breaks. Do not allow 5,000 characters per input or silently truncate text. Count Unicode code points, not bytes or UTF-16 code units.

Example creation payload:

```json
{
  "title": "Login form accepts an empty password",
  "description": "Steps: submit an empty password.\nExpected: validation message.\nActual: form proceeds.",
  "severity": "Major",
  "sourceResultId": 42
}
```

### Validation Rules

- Trim leading and trailing whitespace for text validation and submission.
- Mark required fields visibly and display messages near the corresponding inputs.
- Do not send invalid submissions; preserve all entered values for correction.
- Send `POST /api/bugs` as JSON with `Content-Type: application/json`, using the existing `/api` proxy.
- Send only documented creation fields. Omit `status`, `id`, `sourceRunId`, `createdAt`, and `updatedAt`; unknown/read-only fields return `400`. The server sets status to `open`.
- Handle server validation errors even after local validation, because source data can change before the server validates creation.

## 4. Successful Submission

When the tester submits a valid form:

1. The client validates the entered information.
2. A request is sent to the backend.
3. The interface displays a submitting state.
4. The Submit button is disabled while the request is processing.
5. A valid HTTP `201` response with `success: true`, the complete Bug resource in `data`, and `error: null` confirms creation; display a success message.
6. The tester is navigated to the newly created bug report.

Example message:

"Bug report created successfully."

The bug report must retain its association with the original failed test result.

The exact navigation destination must be confirmed against the agreed application routes.

## 5. Loading States

Loading states must clearly indicate when the application is processing data.

### Initial Loading

When required test-result information is being loaded:

- Display a loading indicator.
- Prevent submission until required data is available.
- Display an error if the data cannot be retrieved.

### Form Submission

During submission:

- Display "Submitting..." or an equivalent progress indicator.
- Disable repeated submission actions.
- Keep existing form values visible.
- Do not navigate away before receiving a confirmed successful response.

## 6. Empty States

The interface must handle cases where required information is unavailable.

### No Failed Test Results

If no failed test results are available, display:

"No failed test results available."

The interface must not offer bug creation from a nonexistent failed test.

### Missing Test Result

If the selected test result cannot be found:

- Display an informative error.
- Prevent submission without a valid test-result reference.
- Provide navigation back to the test run.

## 7. Server Error Handling

The client must handle network errors, server failures, and invalid responses.

Use the HTTP status and `{ success, data, error }` envelope rather than parsing error wording. Failure responses have `success: false`, `data: null`, and a readable string in `error`. The API does not promise structured field-specific errors; display the returned message without guessing field mappings from its text.

For a definite rejection with a valid failure envelope (`400`, `404`, `409`, `413`, or `415`), stop the loading state, preserve input, and explain the problem. Allow an explicit corrected submission when valid. `400` covers invalid fields, `404` a missing source, `409` a source no longer failed, `413` an oversized request, and `415` non-JSON content.

A timeout, connection loss, interrupted request, unreadable/invalid response, or `5xx` leaves creation uncertain: the server might already have saved the bug. Stop the submitting indicator, retain the draft, keep resubmission disabled, and offer section 9’s reconciliation flow. Do not navigate to a success page or simply invite an immediate retry.

Example message: "The bug may have been saved. Check existing bugs before submitting again."

## 8. Preserving User Input

User-entered information must not be lost because of submission failure.

The client must preserve:

- Title
- Combined description and submitted payload
- Severity
- Steps to reproduce
- Expected result
- Actual result
- Associated test result
- Submission time and source case/run IDs used for reconciliation

Validation errors and server errors must not reset the form.

The form should only be cleared after confirmed successful submission or when the tester explicitly discards the entered information.

## 9. Retry and Duplicate Prevention

The interface must prevent accidental duplicate bug reports.

Each accepted POST creates a new resource. This API has no idempotency key, replay guarantee, or deduplication by title or source result. Automatic POST retries are forbidden, including in API helpers: the first request might have saved the bug even if its response was lost.

- Disable Submit and guard all submission actions while a POST is pending, including repeated keyboard submissions.
- Retain the form, submitted payload, source IDs, and submission time on explicit submission.
- After an uncertain outcome, keep resubmission disabled until the reconciliation checks succeed.

### GET-based reconciliation

1. Offer **Check existing bugs**. Preserve the original draft when opening a candidate and returning to the form.
2. For a source-linked submission, use `GET /api/bugs?sourceResultId=42&sort=id&order=desc&page=1` with the actual source ID. For a standalone submission, start with `GET /api/bugs?sort=id&order=desc&page=1`. Do not add status or severity filters that could hide a saved bug.
3. Use fresh server responses, not cached/offline lists. Read `data.items` and pagination metadata, follow relevant pages (20 items per page), and open candidates with `GET /api/bugs/:id`. A first-page check or title alone is insufficient.
4. Compare submitted title, description, severity, and links, accounting for server trimming. For a source-linked submission, compare result ID and its case/run IDs, allowing for a case ID derived rather than sent. Creation time is only a clue, not a unique identifier or exact client/server clock match.
5. If the tester identifies the saved bug, open/use it without another POST. If several records are plausible, show them for inspection instead of claiming one is the saved request.
6. If necessary reads fail, retain the draft and unresolved state, keep resubmission disabled, and offer another read attempt. GET retries are safe because reads do not create or modify bugs; use bounded retries or user-operated refresh.
7. After successful reads and a refreshed check of relevant pages, a tester who finds no saved bug may explicitly choose to submit again with the preserved draft. Explain that a late original request or concurrently edited record can still produce a duplicate. No match is not proof that creation failed; never resubmit automatically.

Button disabling and reconciliation reduce accidental duplicates but cannot guarantee exactly-once creation.

## 10. Keyboard Accessibility

The bug creation interface must support keyboard-only interaction.

Requirements:

- All interactive elements must be accessible using the Tab key.
- Keyboard navigation must follow a logical order.
- Buttons must support appropriate Enter and Space key interactions.
- Focus must be clearly visible.
- Validation errors must be accessible to screen-reader users.
- After invalid submission, focus should move to the first invalid field or an error summary.
- Keyboard focus must not be lost when submission fails.

If the form opens in a modal, keyboard focus must be managed appropriately within the dialog.

## 11. Labelled Form Controls

Every form control must have a visible and accessible label.

Requirements:

- Each input must have an associated label.
- Required fields must be clearly identified.
- Error messages must be associated with their respective inputs.
- Placeholder text must not replace labels.
- Screen readers must be able to identify errors and required fields.
- Submission status messages must be available to assistive technologies.

## 12. Given/When/Then Acceptance Scenarios

These are future acceptance checks, not tests of an implemented client.

| Scenario | Given | When | Then |
|---|---|---|---|
| Explicit creation | A result is failed | The tester opens Create Bug | Show its result ID in the form; send no POST until explicit submission. |
| Successful creation | Valid inputs and failed source `42` | The tester submits | Send one POST with combined description, severity, and `sourceResultId: 42`; on a valid `201` envelope, open the returned bug with derived links. |
| Severity validation | Severity is missing or outside the four allowed values | The tester submits | Show a validation error, retain input, and send no POST. |
| Text boundaries | All other inputs are valid | A trimmed title has 200 code points or assembled description has 5,000 | Accept the boundary; reject 201 or 5,001 respectively without POST or truncation. |
| Blank reproduction field | Steps, Expected, or Actual is whitespace-only | The tester submits | Identify the missing input, retain the draft, and send no POST. |
| Stale source | The source was deleted or is no longer failed | POST returns `404` or `409` respectively | Explain the source issue and preserve the draft. |
| Repeated submission | A POST is pending | Submit is clicked repeatedly or activated by keyboard | Only one POST is sent and input remains visible. |
| Definite rejection | POST returns a valid `400` failure envelope | The client handles it | Show the error and retain input for explicit correction; no automatic retry. |
| Lost response | The server saves bug `17` | The response is lost, unreadable, or replaced by `5xx` | Preserve payload, IDs, time, and draft; show uncertainty and disable resubmission pending reconciliation. |
| Later-page match | The outcome is uncertain | Fresh list pages and detail GETs find the saved bug | Let the tester identify and open it without another POST; preserve the draft during inspection. |
| Standalone match | The uncertain submission has no source | The tester checks existing bugs | Use the unfiltered descending-ID list, pagination, and candidate detail GETs. |
| Failed reconciliation | Creation is uncertain | A necessary GET fails | Retain the unresolved draft, disable resubmission, and allow another GET attempt. |
| Multiple candidates | Several records plausibly match | The tester checks existing bugs | Show candidates for inspection; do not choose one automatically or resend POST. |
| No match | Successful fresh reads and a refreshed page check find no match | The tester explicitly resubmits after the duplicate-risk explanation | Reuse the draft; make no exactly-once guarantee. |
| Existing report | A result already has a bug | The tester deliberately reports another defect | Allow explicit creation; title/source ID does not deduplicate requests. |
| Later source edits | A bug retains its source | Outcome or notes change | Keep the link and bug description; show current source details separately from failed-at-reporting history. |
| Accessible correction | A keyboard or screen-reader user submits invalid input | Errors appear | Associate errors with labelled controls and focus the first invalid input or error summary. |

## 13. Open Review Questions

- Which client route should display the newly created bug? The API defines resources, not application routes.
- The team must confirm the remaining design decisions in API contract section 9 before implementation. This alignment does not itself approve them.
