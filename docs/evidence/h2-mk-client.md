# MK H2 Bug client evidence

Client implementation: `1d805370fbe320a557c3220ccca663b8f8c7a479` on
`codex/mk-h2-bug-client`, based on updated main `120d261`. The original branch
`codex/mk-h1-individual-evidence` was clean and remains preserved. Main was only
fast-forwarded locally; it was neither pushed nor merged by this work.

- [Client PR #18](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/18)
- [BK review surface](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/18/files): `bkuvshinnikov` requested; no approval claimed.
- [Response to BK's blocker and re-review handoff](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/18#discussion_r4700069220): final implementation `1d80537`, real uncertain-PUT recovery results, and explicit choices described. PR marked ready; BK re-review requested.
- [Real backend dependency, MR PR #17](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/17), tested at `f41640dd0250288e4bc23f33eae55600f9a577c8`.
- [H1 API](../h1/bug-api-contract.md), [client behavior](../h1/client-behaviour.md), and [ADR](../h1/architecture-decision.md).

## Actual environment and commands

Agent-operated verification on 2026-11-25: Linux x86_64, Node v24.22.1,
npm 11.19.1, SQLite 3.53.4, headless installed Chrome 158.0.8127.36.
The shell default Node v26 was deliberately replaced with the supported Node 24
in each verification command. [Exact environment](captures/mk-2026-11-25-h2/environment.json).

| Check | Actual result/output |
| --- | --- |
| `npm test` in client branch | Exit 0: **65 client + 60 inherited server tests**; [output](captures/mk-2026-11-25-h2/tests.txt). |
| `npm run lint` | Exit 0, no warnings; [output](captures/mk-2026-11-25-h2/lint.txt). |
| `npm run build` | Exit 0; [output](captures/mk-2026-11-25-h2/build.txt). |
| `npm run verify:sqlite` | Exit 0, Node v24.22.1, native SQLite 3.53.4 write/read passed. |
| `npm test --prefix /tmp/mk-h2-integration -w server` | Exit 0: **82 server tests** from MR's backend; [output](captures/mk-2026-11-25-h2/backend-integration-tests.txt). The deliberate database fault stack accompanies a passing backend failure assertion. |
| Real Chrome workflow | Exit 0; [actual browser results](captures/mk-2026-11-25-h2/browser-results.json). |
| SQLite reopen after stopping server | 24 synthetic Bugs persisted, selected records matched, integrity `ok`, no FK violations; [output](captures/mk-2026-11-25-h2/sqlite-reopen.json). |
| `git diff --check` | Exit 0. |

The additional 25 client checks cover transport classification/envelopes, fresh
paginated/detail reconciliation (including standalone reads), Unicode boundaries,
source/case mismatches, multiple candidates, explicit creation, duplicate-submit
guards, rejected/uncertain writes, failed reads, retained drafts, complete PUT,
immutable source identity, empty states, and validation focus/error association.
Component tests mock API helpers; these results alone are not integration evidence.

## Real integration and final captures

MR's backend was exported into `/tmp/mk-h2-integration` and started with its
`scripts/start-isolated.mjs`, pointing to a newly created synthetic SQLite file.
The actual client ran through Vite at `http://127.0.0.1:5173`, proxying `/api` to
`http://127.0.0.1:3001`. No production or existing working database was migrated.
The backend dependency is deliberately absent from this focused client PR:
main without PR #17 does not provide the Bug endpoints.

The final browser run at the implementation SHA above:

1. Opened Create Bug from result 2/run 1 without POST, submitted using keyboard,
   and confirmed the saved resource had derived case 2/run 1/result 2 identity.
2. Edited the title and traversed `open → in-progress → resolved → closed → open`
   through real complete PUT requests; subsequent API reads confirmed persistence.
3. Changed the source outcome to passed; the detail showed its current outcome
   separately from failed-at-reporting history. Source navigation focused the exact
   result. Marking it failed again sent no Bug POST.
4. Sent a real POST, allowed SQLite commit, and aborted only the browser response.
   The UI retained uncertainty and disabled creation. Added 21 synthetic reports
   through the real API to move the saved Bug onto page 2.
5. Aborted one reconciliation GET: uncertainty remained and resubmission stayed
   unavailable. A user-operated read then checked both pages and every candidate
   detail twice. The saved Bug appeared on page 2. Candidate inspection/return
   retained the draft; explicit identification reused the saved Bug without POST.
6. Aborted a further request before it reached the server to exercise a real
   no-match outcome. Successful refreshed reads sent no POST. Only the explicit
   duplicate-risk action submitted again, and the real server saved that Bug.
   Browser-originated POST count was exactly four; 21 API fixture writes were
   separate. There were no browser page errors.
7. Exercised BK's uncertain PUT finding against the real backend: an update
   committed before its response was aborted. A later local edit survived a failed
   refresh and a successful fresh read, with Save still blocked. Explicit adoption
   loaded the committed version with no PUT. A separate interrupted update tested
   the deliberate overwrite choice: that choice sent no write; only the following
   explicit Save persisted the retained draft. The browser recorded three PUT
   attempts in these recovery checks, in addition to four earlier lifecycle PUTs.
8. Stopped the isolated server and reopened its database with a fresh connection.
   All 24 Bugs and the selected source-linked records persisted.

Only the final four selected UI captures are published:

- [Saved details/status success](captures/mk-2026-11-25-h2/saved-success.png)
- [Uncertain response after actual commit](captures/mk-2026-11-25-h2/uncertain-after-real-commit.png)
- [Refreshed reconciliation with later-page candidate](captures/mk-2026-11-25-h2/reconciled-later-page.png)
- [Uncertain PUT: fresh saved version versus retained draft, Save blocked](captures/mk-2026-11-25-h2/uncertain-update-compared.png)

[PR #18's capture handoff](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/18#issuecomment-7172621509) asked BK to reuse final states rather than duplicate screenshots after each edit. BK reviewed the implementation and requested changes; no approval is claimed. The fourth capture addresses that specific review finding.
These captures are author-side agent evidence, not BK's independent verification.

The [browser runner](captures/mk-2026-11-25-h2/browser-check.mjs) is retained for
inspection/reproduction. It requires a temporary `playwright-core` installation
outside the repository and an installed Chrome; it adds no project dependency.
With the isolated backend on 3001 and client on 5173, run with Node 24:

```sh
PLAYWRIGHT_MODULE=/tmp/mk-h2-browser/node_modules/playwright-core/index.mjs node docs/evidence/captures/mk-2026-11-25-h2/browser-check.mjs /tmp/mk-h2-recheck
```

The runner writes synthetic fixtures and expects the seeded source result 2.
Use a new isolated database. Chrome's executable path is recorded in the runner.
The controlled transport aborts do not fabricate successful HTTP envelopes:
creation/update/candidate data comes from Express and SQLite.

## Actual bounded keyboard observation

In real Chrome, pressing **Enter** on the empty Create Bug submit moved focus to
`bug-title`. The visible/accessibly associated label was `Title (required)`;
`aria-invalid="true"` and `aria-describedby="error-title"` connected it to
`Enter a title of 1–200 characters.` The computed focus outline was
`rgb(15, 118, 110) solid 2px`. After typing the title, actual Tab presses moved
through `bug-steps`, `bug-expected`, `bug-actual`, `bug-severity`, then Create Bug.
Arrow keys selected Major and Enter submitted successfully. Source navigation
later focused `result-2`. These are automation-observed browser key events;
no human keyboard session, screen-reader audit, or exhaustive accessibility claim
is implied.

## Review and understanding of assisted output

Codex assisted implementation, test writing, code review, browser operation,
and this evidence record. Agent review checked that Bug writes occur only in
explicit submit handlers, creation retains the original attempted payload/source,
uncertainty gates resubmission, reconciliation uses fresh unfiltered-by-status
list/detail reads across pagination, and complete PUT retains the case while
omitting both source fields. Drafts live above routes and are memory-only.
Source references describe origin, not a frozen snapshot. Two refreshed read
passes reduce duplicate risk but do not establish exactly-once creation.

The initial checks found obsolete baseline assertions excluding Bugs, an error
message entering the label's accessible text, and a real Chrome status-label
lookup failure. The assertions and label associations were corrected; final
results above were rerun after the fixes. Earlier failed-run captures remain
under `/tmp` and are not presented as final evidence.

BK's [initial review](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/18#pullrequestreview-6063856650) and [follow-up](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/18#pullrequestreview-6063871333) correctly identified that fresh reads alone re-enabled an uncertain PUT with a stale draft. The [inline finding](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/18#discussion_r4699950615) is addressed by preserving the attempted update and blocking Save until an explicit choice: adopt the fresh saved version, or authorize keeping the draft before a separate explicit Save. Failed reads offer neither choice. Writes are also blocked while fresh reads are pending, preventing an older in-flight read from being used to recover a newer uncertain write. Component checks exercise both refresh outcomes and both choices; the final real browser run repeats the committed-response-loss case. BK re-review remains pending.

**MK's personal human review/understanding statement remains pending.** The agent
asked MK to inspect the PR and supply it; no human judgment or BK approval has
been fabricated. MK should record what was personally inspected and understood
at the exact reviewed SHA. BK's independent review and integration with MR's
backend remain review/integration responsibilities; neither main nor this PR was
merged by the agent.
