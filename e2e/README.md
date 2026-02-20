# E2E Tests for OpenHackathon

This directory contains Playwright end-to-end tests for the OpenHackathon platform.

## Test Structure

```
e2e/
├── auth.spec.ts          # Authentication flow tests
├── judge-flow.spec.ts    # Judge workflow tests
├── admin-flow.spec.ts    # Admin workflow tests
├── public-pages.spec.ts  # Public pages tests
└── smoke.spec.ts         # Quick smoke tests
```

## Running Tests

### Using the test runner script

```bash
# Run all tests (headless mode)
./run-tests.sh

# Run tests with visible browser
./run-tests.sh headed

# Run smoke tests only
./run-tests.sh smoke

# Run specific test suite
./run-tests.sh auth      # Authentication tests
./run-tests.sh judge     # Judge workflow tests
./run-tests.sh admin     # Admin workflow tests
./run-tests.sh public    # Public pages tests

# Interactive UI mode
./run-tests.sh ui

# Debug mode
./run-tests.sh debug

# Open test report
./run-tests.sh report
```

### Using npm scripts

```bash
# Run all tests
npm run test:e2e

# Run with visible browser
npm run test:e2e:headed

# Interactive UI mode
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug

# Run smoke tests
npm run test:e2e:smoke
```

### Using npx directly

```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test auth.spec.ts

# Run with UI
npx playwright test --ui

# Generate code by recording actions
npx playwright codegen http://localhost:5173
```

## Test Coverage

### Authentication (auth.spec.ts)
- Login page navigation
- Admin login flow
- Judge login flow
- Demo mode indicator

### Judge Workflow (judge-flow.spec.ts)
- Dashboard stats display
- Judging queue view
- Starting a review
- Scoring a project
- Filtering by status
- Navigation

### Admin Workflow (admin-flow.spec.ts)
- Dashboard stats
- Hackathons management
- Projects list view
- Assignment manager
- Leaderboard view
- Scoring reports
- Settings access

### Public Pages (public-pages.spec.ts)
- Landing page
- Projects gallery
- Leaderboard
- Documentation
- Submit project
- Navigation between pages

### Smoke Tests (smoke.spec.ts)
- Application loads without errors
- All main routes accessible
- Responsive layout
- No console errors

## Writing New Tests

1. Create a new `.spec.ts` file in the `e2e/` directory
2. Import the test utilities:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Expected Text')).toBeVisible();
  });
});
```

## Configuration

Playwright configuration is in `playwright.config.ts`:
- Base URL: `http://localhost:5173`
- Browser: Chromium
- Test directory: `./e2e`
- Reporter: HTML

## Debugging

1. Use `--debug` flag to step through tests
2. Use `--ui` flag for interactive test runner
3. Check screenshots in `test-results/` on failure
4. View trace in `test-results/` for detailed debugging

## CI/CD Integration

Tests are configured to run in CI mode with:
- `CI=true` environment variable
- Retries: 2
- Workers: 1 (sequential)
- Full trace on first retry
