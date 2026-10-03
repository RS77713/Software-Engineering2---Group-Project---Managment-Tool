// Derives the editable draft fields (name, feature, status) for a suite's
// inline edit form, straight from the suite itself. TestSuiteDetailPage
// calls this both when opening the edit form and when cancelling it, so
// neither transition can leave a previously-typed-but-discarded draft
// sitting in the fields for the next edit session.
export function getSuiteEditFields(suite) {
  return {
    name: suite.name,
    feature: suite.feature,
    status: suite.status,
  }
}
