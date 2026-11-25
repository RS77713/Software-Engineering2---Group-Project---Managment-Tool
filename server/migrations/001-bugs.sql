-- SQLite length(TEXT) stops at NUL. For counting only, replace zero hex
-- digits with ones: every byte keeps its UTF-8 width/category, with no NUL.
-- Replacing whole '00' pairs would incorrectly match across byte boundaries.
CREATE TABLE bugs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL CHECK (length(CAST(unhex(replace(hex(title), '0', '1')) AS TEXT)) BETWEEN 1 AND 200),
  description TEXT NOT NULL CHECK (length(CAST(unhex(replace(hex(description), '0', '1')) AS TEXT)) BETWEEN 1 AND 5000),
  severity TEXT NOT NULL CHECK (severity IN ('Critical', 'Major', 'Minor', 'Trivial')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved', 'closed')),
  test_case_id INTEGER REFERENCES test_cases(id) ON DELETE SET NULL,
  source_result_id INTEGER REFERENCES test_run_results(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (source_result_id IS NULL OR test_case_id IS NOT NULL)
);

CREATE INDEX idx_bugs_test_case_id ON bugs(test_case_id);
CREATE INDEX idx_bugs_source_result_id ON bugs(source_result_id);

-- Outcomes/notes remain editable; a retained result must keep its identity.
CREATE TRIGGER retain_bug_source_identity
BEFORE UPDATE OF id, run_id, test_case_id ON test_run_results
WHEN (NEW.id IS NOT OLD.id OR NEW.run_id IS NOT OLD.run_id OR NEW.test_case_id IS NOT OLD.test_case_id)
  AND EXISTS (SELECT 1 FROM bugs WHERE source_result_id = OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'cannot change the identity of a retained bug source');
END;
