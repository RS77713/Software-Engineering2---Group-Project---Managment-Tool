# H1 — Client Behaviour Contract

## 1. Overview

This document describes the expected client-side behaviour for creating bug reports from failed test results in the QA Management Tool.

The purpose is to define a consistent user experience, including form validation, successful submission, error handling, duplicate prevention, and accessibility.

The behaviour described here must remain consistent with the Bug API contract defined in `docs/h1/bug-api-contract.md`.

## 2. Starting Bug Creation

A tester should be able to create a bug report directly from a failed test result.

Expected workflow:

1. The tester opens a test run.
2. The tester selects a test result with the status `Failed`.
3. The interface provides a **Create Bug** action.
4. Selecting this action opens the bug creation form.
5. The form automatically associates the bug with the selected failed test result.
6. The tester enters the necessary bug details and submits the form.

If a bug is already associated with the test result, the interface should provide access to the existing report and avoid unintentionally creating duplicates.

## 3. Required Fields and Validation

The interface must indicate which fields are required and display understandable validation messages.

The following fields are proposed, pending confirmation against the Bug API contract:

| Field | Validation | Error Message |
|---|---|---|
| Title | Required, non-empty | "Bug title is required." |
| Description | Required, non-empty | "Description is required." |
| Steps to Reproduce | Required, non-empty | "Steps to reproduce are required." |
| Expected Result | Required, non-empty | "Expected result is required." |
| Actual Result | Required, non-empty | "Actual result is required." |
| Related Test Result | Must reference a valid failed result | "A valid failed test result is required." |

### Validation Rules

- Leading and trailing whitespace should be ignored when checking for empty values.
- Required fields must be visibly marked.
- Validation messages must appear near the corresponding inputs.
- Invalid submissions must not be sent to the server.
- Existing user input must remain available when validation fails.
- Any server-side validation errors must also be shown to the user.
- Field constraints must match those defined by the API contract.

## 4. Successful Submission

When the tester submits a valid form:

1. The client validates the entered information.
2. A request is sent to the backend.
3. The interface displays a submitting state.
4. The Submit button is disabled while the request is processing.
5. When the server confirms successful creation, the interface displays a success message.
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

When submission fails:

1. Stop displaying the loading state.
2. Display an understandable error message.
3. Preserve all information entered by the tester.
4. Allow another submission attempt when retrying is safe.
5. Avoid navigating away from the form.

Example message:

"Unable to create the bug report. Please try again."

If the server returns field-specific errors, display them beside the corresponding fields.

If the request outcome is unknown, the interface must not assume that no bug was created.

## 8. Preserving User Input

User-entered information must not be lost because of submission failure.

The client must preserve:

- Title
- Description
- Steps to reproduce
- Expected result
- Actual result
- Associated test result
- Any additional entered fields

Validation errors and server errors must not reset the form.

The form should only be cleared after confirmed successful submission or when the tester explicitly discards the entered information.

## 9. Retry and Duplicate Prevention

The interface must prevent accidental duplicate bug reports.

Expected behaviour:

- Disable the Submit button while a submission request is active.
- Prevent rapid repeated clicks from sending multiple requests.
- Do not automatically retry a potentially successful request without duplicate protection.
- Preserve the original form values when retrying.
- Reuse the same submission identifier for retries if the backend supports idempotency.
- If a previous submission may have succeeded, verify its outcome before issuing another creation request.

Client-side button disabling alone cannot guarantee duplicate prevention.

The client and backend must agree on an appropriate duplicate-prevention mechanism in the Bug API contract.

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
- Submission status messages must be available to assistive technologies
