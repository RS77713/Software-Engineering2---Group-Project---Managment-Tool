# H2 post-merge CI focus assertion

Date: 2026-11-27. Owner: EM (`RS77713`). Base: `3f0f9f0b2e13a0b1f0de9339b0b37b7d89290550`, the approved PR #21 merge.

The [main verify run](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/actions/runs/46022260885) failed at `BugWorkflow.test.jsx`: the first workflow test found the Create Bug link but immediately observed an empty active-element ID instead of `result-42`. That run passed 64 client tests and failed one; server tests, build and smoke were not reached. Earlier green runs are not substituted for this failure.

The result page applies selected-result focus in a `useEffect` after rendering the loaded run. Finding the link establishes that its DOM exists; it does not synchronize the separate focus effect. The correction wraps the existing exact focus assertion in Testing Library's existing `waitFor`. It adds no fixed sleep, retry of the whole test, assertion removal, timeout increase, dependency change or application-code change. Missing or wrong focus still fails the assertion.

Assisted local verification used Windows, Node v24.21.0 and the existing locked Vitest 5.0.0 installation, without reinstalling dependencies:

| Command | Result |
| --- | --- |
| `node node_modules/vitest/vitest.mjs run --root client src/pages/BugWorkflow.test.jsx` | Passed 13 tests, exit 0; repeated once with the same result. |
| `node node_modules/vitest/vitest.mjs run --root client` | Passed all 65 client tests in 11 files, exit 0. |
| `git diff --check` | Passed, exit 0. |

Raw failure and local outputs are retained in the ignored local delivery archive. This checks synchronization of the existing focus expectation; it is not a new browser/accessibility acceptance run or proof that no other intermittent failure exists. The usable application checkpoint remains `2b76cd99d4244d98023bcdd3b93ab17d2e3bdd15`. Review of this correction and full CI on its revision are recorded in its pull request before integration; the prior evidence-index approval remains at [MR review 6089947071](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/21#pullrequestreview-6089947071).

## Recorded disposition — 2026-11-27

BK [approved revision `1c1386dfaaddd81811f6acb58376462cafe269d4`](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/22#pullrequestreview-6091263208), checking the preserved focus requirement and the evidence note. [PR #22](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/22) merged at `274693b621c071da9c82cdfcac7d71d9d7b9f1e6`. [Main CI 46038360113](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/actions/runs/46038360113) passed install, native SQLite probe, lint, all 65 client and 82 server tests, build and API/SQLite smoke. The merge matches the reviewed correction; no runtime source, configuration or dependencies changed. This disposition closes the recorded CI failure without repeating personal confirmations or the original index review.
