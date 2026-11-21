# EM — H1 contribution and focused verification

**Status:** recorded automated result; personal reproduction and explanation pending.
Owner: EM (`RS77713`). Application checkpoint:
`e665be8a26e7c746c60e5680a6617766dbeb54b1`. Date: 2026-11-21, Europe/Riga.

## Engineering contribution and review

- [Architecture PR #9](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/9): compare the existing application boundary with a separate service and browser-only storage; choose a focused module and document retry, retention and migration consequences.
- [Readiness PR #12](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/12): pin the installation tools, verify native SQLite and provide supported loopback/fresh-data startup after MR identified a wildcard-binding gap.
- [Substantive API review](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/3#pullrequestreview-5589588533): identify absent failed-execution identity and the duplicate risk from uncertain POST retries. [Follow-up approval](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/3#pullrequestreview-5729682601) checks their resolution.

These links identify the actual reviewed artifacts and findings. They do not establish a personal command run by EM.

## Reproducible observed result

Command: `node --test server/test/test-runs.test.js`.

Windows win32-x64; Node v24.21.0; installed better-sqlite3 13.0.3.
This command invokes Node directly. No npm installation, tool upgrade or fresh dependency install was performed during this check; system npm remains 10.8.3. Reproduction setup remains the pinned npm 11.19.1 instructions in README.

| Input | Expected | Actual |
| --- | --- | --- |
| Create a run from two suite cases; then add another suite member | 201 with two pending results; existing run retains its original two members | Existing assertions passed |
| Update one result to passed and another to failed | Run completes as failed with one pass, one fail and end time | Existing assertions passed |
| Update an existing result using `{result:"unknown"}` | HTTP 400 with `result must be one of` error | Existing assertions passed |

**Observed:** 3 tests passed, 0 failed; process exit 0.
[Exact output](captures/em-2026-11-21/h1-focused-smoke.txt) and
[structured record](captures/em-2026-11-21/h1-focused-smoke.json).

The test fixture uses a unique temporary SQLite database and real HTTP requests.
It closes its server/database and cleans up its temporary database files.
Fixture text `createdBy: "MK"` is inherited test input, not attribution of this run.
Git comparison confirms the test, app, database module and run route are unchanged between the Part I baseline and this checkpoint.

## Explanation and limits

The test demonstrates that inherited run creation, result aggregation and invalid-result rejection work together through the actual API/database boundary. It provides a baseline for the proposed defect-reporting workflow, which depends on identifying a failed result. The invalid-input check verifies the 400 response and error text; it does not independently compare all stored fields before and after rejection. This run does not test a browser, a new Bug implementation, advisory remediation or operational recovery.

The paragraph above is the explanation of the recorded automated check. EM's own explanation and personal reproduction must be recorded separately after they occur. Automated command execution was performed through the coding agent on EM's workspace. EM previously confirmed personal inspection of Home/Dashboard screenshots only; no broader personal run is inferred.

## Remaining personal step

With dependencies available through the documented setup, EM personally runs:

```powershell
git rev-parse HEAD
node --version
node --test server/test/test-runs.test.js
$LASTEXITCODE
```

Save actual output and exit code. Record the actual checkout SHA (a documentation-only index revision can differ from the engineering checkpoint). Explain in EM's own words what passed, why the invalid input should fail and what remains unverified. A screenshot can corroborate the run but is not required if attributable command output and explanation are recorded. Do not copy a proposed explanation as a claim of personal verification.
