-- Inherited schema from part1-baseline (bc304f1d954cb1e55d5ec7cdd06e49bba455613e).
-- Deliberately independent of the new migration runner.
CREATE TABLE IF NOT EXISTS test_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    preconditions TEXT,
    steps TEXT NOT NULL,
    expected_result TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('Critical', 'Major', 'Minor', 'Trivial')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'passed', 'failed', 'skipped')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
CREATE TABLE IF NOT EXISTS suites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    feature TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'in-progress', 'passed', 'failed')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
CREATE TABLE IF NOT EXISTS suite_test_cases (
    suite_id INTEGER NOT NULL REFERENCES suites(id) ON DELETE CASCADE,
    test_case_id INTEGER NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL,
    PRIMARY KEY (suite_id, test_case_id)
  );
CREATE TABLE IF NOT EXISTS test_runs_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suite_id INTEGER NOT NULL REFERENCES suites(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'in-progress' CHECK (status IN ('in-progress', 'passed', 'failed')),
    pass_count INTEGER NOT NULL DEFAULT 0,
    fail_count INTEGER NOT NULL DEFAULT 0,
    skip_count INTEGER NOT NULL DEFAULT 0,
    start_time TEXT NOT NULL,
    end_time TEXT,
    created_by TEXT NOT NULL
  );
CREATE TABLE IF NOT EXISTS test_run_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES test_runs_v2(id) ON DELETE CASCADE,
    test_case_id INTEGER NOT NULL REFERENCES test_cases(id),
    result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending', 'passed', 'failed', 'skipped')),
    duration_ms INTEGER,
    notes TEXT
  );
