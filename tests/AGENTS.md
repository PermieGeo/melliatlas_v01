# Browser and Integration Test Guidance

Extends [root engineering guidance](../AGENTS.md) and [TESTS](../docs/TESTS.md). Keep detailed commands and test inventories in the latter document.

- Assert user-visible and persisted behavior, not incidental implementation structure or CSS class names. Derive expectations from requirements, contracts or a reproduced defect.
- Cover relevant happy paths, invalid inputs, boundaries, errors, retries, stale-result handling and accessibility. Test actual navigation and interactions where those are part of the requirement.
- Use deterministic fixtures and clocks; stub true external boundaries, never the behavior being tested. Avoid dependence on live providers, private credentials or arbitrary waits.
- Distinguish browser tests with mocked API responses from full-stack/database tests; neither substitutes for the other when a contract crosses both layers.
- Never suppress a legitimate failure, skip a valid scenario or loosen an assertion just to obtain a green result. If the expectation is wrong, explain it using independent specification evidence and preserve the regression intent.
- Exercise relevant desktop/mobile viewports, keyboard/touch behavior and async feedback without hard-coded pixel sizes unless the requirement or a real regression demands them.
