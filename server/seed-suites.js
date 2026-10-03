import { db } from './db.js'

// Two realistic suites built from the seeded test cases, so /test-suites has
// something to show immediately. Only inserted if the suites table is empty.
// Cases are looked up by title rather than a hardcoded id, so this still
// works if the test case seed data ever changes.
const SUITE_SEEDS = [
  {
    name: 'Account Flows Suite',
    feature: 'Account',
    status: 'ready',
    daysAgo: 1,
    caseTitles: [
      'Login with valid credentials [Authentication]',
      'Reset a forgotten password [Authentication]',
      'Update profile picture [Profile]',
    ],
  },
  {
    name: 'Shopping & Search Suite',
    feature: 'Shopping',
    status: 'draft',
    daysAgo: 2,
    caseTitles: [
      'Add item to cart [Shopping Cart]',
      'Search returns relevant results [Search]',
      'Login with valid credentials [Authentication]',
    ],
  },
]

export function seedSuites() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM suites').get()
  if (count > 0) return

  const insertSuite = db.prepare(`
    INSERT INTO suites (name, feature, status, created_at, updated_at)
    VALUES (@name, @feature, @status, @createdAt, @updatedAt)
  `)
  const findTestCaseId = db.prepare('SELECT id FROM test_cases WHERE title = ?')
  const insertLink = db.prepare(`
    INSERT INTO suite_test_cases (suite_id, test_case_id, sort_order)
    VALUES (@suiteId, @testCaseId, @sortOrder)
  `)

  const insertAll = db.transaction((seeds) => {
    for (const seed of seeds) {
      const timestamp = new Date(Date.now() - seed.daysAgo * 24 * 60 * 60 * 1000).toISOString()
      const info = insertSuite.run({
        name: seed.name,
        feature: seed.feature,
        status: seed.status,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      const suiteId = info.lastInsertRowid

      seed.caseTitles.forEach((title, index) => {
        const testCase = findTestCaseId.get(title)
        if (!testCase) return
        insertLink.run({ suiteId, testCaseId: testCase.id, sortOrder: index })
      })
    }
  })

  insertAll(SUITE_SEEDS)
  console.log(`Seeded ${SUITE_SEEDS.length} test suites.`)
}
