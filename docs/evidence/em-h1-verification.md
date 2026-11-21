# EM — H1 contribution and focused verification

**Status:** MR assessed EM's documented assisted verification/explanation as satisfactory on 2026-11-21. Overall H1 completeness remains pending the remaining team evidence.
Owner: EM (`RS77713`). Application checkpoint:
`e665be8a26e7c746c60e5680a6617766dbeb54b1`. Date: 2026-11-21, Europe/Riga.

## Engineering contribution and review

- [Architecture PR #9](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/9): compare the existing application boundary with a separate service and browser-only storage; choose a focused module and document retry, retention and migration consequences.
- [Readiness PR #12](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/12): pin the installation tools, verify native SQLite and provide supported loopback/fresh-data startup after MR identified a wildcard-binding gap.
- [Substantive API review](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/3#pullrequestreview-5589588533): identify absent failed-execution identity and the duplicate risk from uncertain POST retries. [Follow-up approval](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/3#pullrequestreview-5729682601) checks their resolution.

EM requested and directed this verification through a coding assistant. The work is attributed to EM, with assisted command execution identified separately. On 2026-11-21 EM confirmed reviewing the proposed technical explanation. The confirmation scope is recorded below; it is not evidence of a separately executed terminal run or inspection of every source file/log.

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

### EM's confirmed explanation review — 2026-11-21

After the assisted run, EM was shown a proposed explanation describing successful run creation/result aggregation, invalid-result HTTP 400 rejection, real API/SQLite coverage, and the limits concerning browser behaviour, the planned Bugs feature and dependency security. EM explicitly confirmed review of that explanation. The explanation was prepared with assistance and adopted by EM; it is not presented as a separately authored, unaided answer.

This records a human confirmation of the stated technical interpretation and limits. Earlier personal Home/Dashboard screenshot inspection remains separately confirmed. The latest confirmation does not establish a new manual terminal run, direct inspection of all raw output/source files or independent reproduction without assistance. No full H1 acceptance is inferred.

## Independent assessment and reproduction reference

MR completed the EM-specific assessment at revision `ee243aad4a2240c4cbbaef20a49df8efd9b9ec46` in [review 6006963120](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/13#pullrequestreview-6006963120). He found no additional EM-specific evidence gap for the documented assisted workflow, assessing the combined human direction, preserved execution evidence and confirmed explanation adoption. He did not independently witness EM's actions or test understanding; that limit remains explicit. This is a COMMENT review, not final approval of the whole H1 submission. No further EM rerun or repeated confirmation is requested for this unchanged scope.

The existing command remains available for reproduction:

```powershell
git rev-parse HEAD
node --version
node --test server/test/test-runs.test.js
$LASTEXITCODE
```

For any new run, save actual output, exit code and checkout SHA (a documentation-only index revision can differ from the engineering checkpoint). Explain in EM's own words what passed, why the invalid input should fail and what remains unverified. A screenshot can corroborate the evidence but is not required. Do not copy a proposed explanation as a claim of personal verification.
