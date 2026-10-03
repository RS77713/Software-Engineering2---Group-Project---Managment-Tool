import { db } from './db.js'

// Realistic sample data so the /test-cases page has something to show
// immediately. Only inserted if the table is empty.
const SEED_TEST_CASES = [
  {
    title: 'Login with valid credentials [Authentication]',
    preconditions:
      'A registered user account exists with a known email and password, and the user is logged out.',
    steps: [
      'Open the login page.',
      "Enter the registered user's valid email and password.",
      'Click "Log in".',
    ],
    expectedResult: 'The user is signed in and redirected to the dashboard.',
    severity: 'Critical',
    status: 'ready',
    daysAgo: 1,
  },
  {
    title: 'Reset a forgotten password [Authentication]',
    preconditions:
      'A registered user account exists with a known email address, and the user is on the login page but cannot remember their password.',
    steps: [
      'Click "Forgot password?" on the login page.',
      "Enter the registered account's email address.",
      'Submit the request.',
      'Open the password reset email and click the reset link.',
      'Enter a new password and confirm it.',
      'Submit the new password.',
    ],
    expectedResult: 'The password is updated, and the user can log in with the new password.',
    severity: 'Major',
    status: 'draft',
    daysAgo: 3,
  },
  {
    title: 'Add item to cart [Shopping Cart]',
    preconditions: 'The user is logged in and browsing the product catalog.',
    steps: [
      'Open a product page.',
      'Select a quantity.',
      'Click "Add to cart".',
      'Open the cart.',
    ],
    expectedResult: 'The item appears in the cart with the correct quantity and price.',
    severity: 'Major',
    status: 'passed',
    daysAgo: 5,
  },
  {
    title: 'Search returns relevant results [Search]',
    preconditions: 'The product catalog contains at least one item matching the search term.',
    steps: [
      'Open the search bar.',
      'Type a known product name.',
      'Submit the search.',
    ],
    expectedResult: 'The results list includes the matching product.',
    severity: 'Minor',
    status: 'ready',
    daysAgo: 7,
  },
  {
    title: 'Update profile picture [Profile]',
    preconditions: 'The user is logged in and viewing their profile.',
    steps: [
      'Click "Change photo".',
      'Select an image file.',
      'Confirm the upload.',
    ],
    expectedResult: 'The new photo appears as the profile picture.',
    severity: 'Trivial',
    status: 'failed',
    daysAgo: 10,
  },
]

export function seedTestCases() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM test_cases').get()
  if (count > 0) return

  const insert = db.prepare(`
    INSERT INTO test_cases
      (title, preconditions, steps, expected_result, severity, status, created_at, updated_at)
    VALUES
      (@title, @preconditions, @steps, @expectedResult, @severity, @status, @createdAt, @updatedAt)
  `)

  const insertAll = db.transaction((items) => {
    for (const item of items) {
      const timestamp = new Date(Date.now() - item.daysAgo * 24 * 60 * 60 * 1000).toISOString()
      insert.run({
        title: item.title,
        preconditions: item.preconditions,
        steps: JSON.stringify(item.steps),
        expectedResult: item.expectedResult,
        severity: item.severity,
        status: item.status,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    }
  })

  insertAll(SEED_TEST_CASES)
  console.log(`Seeded ${SEED_TEST_CASES.length} test cases.`)
}
