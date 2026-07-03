# Testing Strategy

## Unit Tests

- Cover pure utilities, guards, and formatters.
- Keep tests close to the code that normalizes inputs or computes permissions.
- Prefer deterministic tests with explicit fixtures.

## Integration Tests

- Cover auth flows, protected routes, and shared API helpers.
- Verify state transitions for login, logout, and session refresh.
- Add tests for any new database adapter or service wrapper.

## End-to-End Tests

- Cover the main public, auth, and admin journeys.
- Smoke-test mobile navigation, role redirects, and critical forms.
- Run a small E2E suite in CI or before production promotion.

## Current Coverage Gap

- The repo has a small Vitest footprint today, so critical business flows still need broader coverage.
- The new shared logout test is a start, not a complete regression net.
