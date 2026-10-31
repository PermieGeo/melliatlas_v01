# Browser Verification Rules

Extends [root AGENTS.md](../AGENTS.md) and [TESTS.md](../docs/TESTS.md).

- Playwright scenarios MUST assert user-visible behavior, not incidental CSS classes or screenshots alone. Use the actual map UI for selection/navigation; API stubs are permitted only at network boundaries.
- Cover both configured desktop and mobile projects. Test success, empty, invalid, offline, error, retry, stale response cancellation, source links and keyboard/touch interaction as those behaviors are implemented.
- Distinguish browser-only tests with intercepted API fixtures from full-stack/database tests. Do not call a stubbed test proof of successful source ingestion.
- Use deterministic fixtures, controlled clocks and bounded waits. Never rely on real external providers, credentials or fixed sleeps.
- When a scenario fails, preserve the independently derived expectation until the implementation is fixed or the spec is shown to contradict it. Never skip, relax, silently retry-to-green or replace a meaningful assertion merely to obtain PASS.
