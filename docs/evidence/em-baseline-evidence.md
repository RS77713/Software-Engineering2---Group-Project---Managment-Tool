# EM baseline verification evidence

Owner: EM (`RS77713`). Reviewer: MR (`makss-rivero`), pending.
Recorded execution window: 2026-10-29 to 2026-10-30 (Europe/Riga).
Related issue: [#2](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/issues/2).
Review: [PR #6](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/6).

## Identity and environment

| Item | Observed value |
| --- | --- |
| Tested application commit | `bc304f1d954cb1e55d5ec7cdd06e49bba455613e` |
| Reachable baseline tag | `part1-baseline` |
| Working branch | `docs/em-h1-baseline` |
| Operating system | Windows reported as `Microsoft Windows 10.0.26300` |
| Node | `v24.21.0` |
| System npm | `10.8.3` |
| npm used for successful installation | `11.19.1`, invoked through `npx` |

This file summarizes captured outputs from EM's machine. It is not evidence
of MK's or BK's independent executions.

## Captured command results

| Command/check | Recorded outcome |
| --- | --- |
| `npm ci` with npm 10.8.3 | Exit 1, MSB8020: ClangCL toolset unavailable during `better-sqlite3` rebuild. |
| `npx --yes --package npm@11.19.1 npm ci` | Exit 0; 201 packages added, 204 audited. Unreviewed install-script warning and audit findings retained. |
| Open/query/close SQLite in memory | Exit 0; SQLite `3.53.4`, status `ok`. |
| `npm run lint` | Exit 0, no lint warnings or errors reported. |
| `npm test` | Exit 0; 40 client tests and 58 server tests passed. |
| `npm run build` | Exit 0; Vite 8.3.0, 53 modules, build completed. |
| `npm run dev` with isolated `DB_PATH` | Vite listening on 5173 and API listening on 3001. |

Selected test-summary output:

```text
Test Files  9 passed (9)
     Tests  40 passed (40)

tests 58
pass 58
fail 0
cancelled 0
skipped 0
todo 0
```

The SQLite-backed server tests passed after the npm 11 installation. This
confirms the module loaded for this run, while the npm 10 compiler prerequisite
and dependency advisory findings remain separate readiness concerns.

## Inspectable installation and audit captures

The following files publish the original recorded results requested in MR's
[review](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/pull/6#pullrequestreview-5729798735).
They are historical captures, not commands rerun on the publication date.

| Capture | Run date | Contents |
| --- | --- | --- |
| [npm 10 failure extract](captures/em-2026-10-30/npm10-install.redacted.txt) | 2026-10-29/30 | Command/version/exit metadata; original MSB8020 ClangCL failure lines and native-build result. Personal/workspace and compiler installation path prefixes are redacted. |
| [npm 11 installation output](captures/em-2026-10-30/npm11-install.txt) | 2026-10-30 | The separate successful command, exit 0, package summary and exact `allowScripts` warning for `better-sqlite3@13.0.3`. |
| [Captured npm audit JSON](captures/em-2026-10-30/npm-audit.json) | 2026-10-30 | Original severity totals and all 10 affected-package records, including dependency paths, ranges, advisory identifiers/URLs and reported fix availability. An added `capture` block identifies the command, date and tested commit. |

The audit's affected package records are `@vitest/mocker`, `body-parser`,
`concurrently`, `proxy-addr`, `qs`, `shell-quote`, `source-map-js`, `undici`,
`vite` and `vitest`. Its totals are 3 moderate, 4 high and 3 critical. Dependency
references in `via` are preserved alongside full advisory objects; a package
record can contain more than one advisory. These totals are affected-package
counts from the captured report, not a count of distinct vulnerabilities
independently investigated by the team.

The capture separates npm 10's failed native compilation from npm 11's completed
installation. Neither a successful Ubuntu CI run nor the later Windows tests
rewrites the recorded installation warning or establishes current audit status.

## Startup and read-only HTTP checks

The database used synthetic seeds in an ignored local verification directory.
The first startup attempt failed because that directory had not yet been
created. After creating it, startup and the following checks succeeded.

| URL | Observation |
| --- | --- |
| `http://localhost:5173/` | HTTP 200; Vite entry point delivered. |
| `http://localhost:3001/api/health` | Successful health response below. |
| `http://localhost:5173/api/health` | Same response through the Vite proxy. |
| `http://localhost:3001/api/dashboard/metrics` | Success; 5 test cases, 2 suites and 1 seeded run. |
| `http://localhost:3001/api/test-cases` | Success; total 5 test cases. |

Health response:

```json
{
  "success": true,
  "data": { "status": "ok" },
  "error": null
}
```

The verification servers were stopped afterward. These checks establish HTTP
delivery and API responses, not a visual browser inspection.

## Readiness and evidence boundaries

- `npm audit --json`, run through npm 11.19.1, exited 1 and reported 10
  vulnerabilities: 3 moderate, 4 high and 3 critical. These are the captured
  audit counts, not an exploitability assessment or a statement of later status.
- No dependency versions, lockfile, compiler installation or application code
  were changed as part of this reproduction.
- Manual visual browser inspection and independent review are pending.
- Original full logs and the isolated database remain under the ignored
  `docs/evidence/local/2026-10-30/` directory. The selected installation outputs
  and captured audit data linked above are committed and accessible to reviewers;
  the private database and entire local archive are not published.
- The baseline tag and earlier CI remain reachable. Earlier CI is separate
  evidence: [baseline checks at the tagged commit](https://github.com/RS77713/Software-Engineering2---Group-Project---Managment-Tool/actions/runs/37111072593).

See [the reproduction document](../h1/baseline-reproduction.md) for inherited
scope, commands, failure explanation, assistance/personal-verification record
and the remaining H1 decisions.
