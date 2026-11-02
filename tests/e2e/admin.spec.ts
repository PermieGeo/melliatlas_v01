import { expect, test } from "@playwright/test";

test("administrator settings do not implicitly start a source fetch", async ({
  page,
}) => {
  let syncCalls = 0;
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/operator/provider/sync")) syncCalls++;
    let result: unknown = { notices: [] };
    if (url.endsWith("/api/v1/sources")) result = { sources: [] };
    if (url.endsWith("/operator/provider/region-scan"))
      result = { regionCode: 55, nextPage: 0, scan: null };
    if (url.endsWith("/operator/provider/status"))
      result = {
        sourceConfigured: true,
        latestRun: null,
        pendingReview: 0,
        pendingWithGeometry: 0,
        verifiedWithGeometry: 0,
        missingGeometry: 0,
      };
    if (url.endsWith("/operator/provider"))
      result = {
        providerName: "Fixture",
        endpoint: "https://example.org/plans",
        revision: "1",
        collectionEnabled: false,
        request: {
          method: "POST",
          regionCode: 55,
          regionParameter: "subject",
          parameters: { pageNumber: 0, pageSize: 40 },
        },
      };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  await page.goto("http://127.0.0.1:5174");
  await expect(
    page.getByRole("heading", { name: "Загрузка данных" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Конфигурация" }).click();
  await expect(
    page.getByRole("button", { name: "Сохранить конфигурацию" }),
  ).toBeVisible();
  expect(syncCalls).toBe(0);
});
