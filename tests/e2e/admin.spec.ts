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
    if (url.endsWith("/operator/provider/viewport/history"))
      result = { entries: [] };
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
    page.getByRole("heading", { name: "Карта и анализ" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Краткая статистика" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Загрузка данных" }).click();
  await expect(
    page.getByRole("heading", { name: "Загрузка данных" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Конфигурация" }).click();
  await expect(
    page.getByRole("button", { name: "Сохранить конфигурацию" }),
  ).toBeVisible();
  expect(syncCalls).toBe(0);
});

test("shows development-only import guidance and inline help", async ({
  page,
}) => {
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    let result: unknown = { notices: [] };
    if (url.endsWith("/operator/provider/viewport/history"))
      result = { entries: [] };
    if (url.endsWith("/operator/provider/status"))
      result = {
        sourceConfigured: true,
        latestRun: null,
        pendingReview: 0,
        pendingWithGeometry: 0,
        verifiedWithGeometry: 0,
        missingGeometry: 0,
      };
    if (url.endsWith("/operator/provider/district-cache"))
      result = { ttlHours: 24, refreshEnabled: false, entries: [] };
    if (url.endsWith("/api/v1/sources")) result = { sources: [] };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  await page.goto("http://127.0.0.1:5174");
  await page.getByRole("button", { name: "Загрузка данных" }).click();
  const dataCollection = page.getByRole("region", { name: "Загрузка данных" });
  const diagnosticsDisclosure = dataCollection.getByText(
    "Дополнительно: ручная диагностика источника и технические координаты",
    { exact: true },
  );
  await expect(diagnosticsDisclosure).toBeVisible();
  const coordinatesDisclosure = dataCollection.getByText(
    "Точные координаты и даты квадрата",
    { exact: true },
  );
  await expect(coordinatesDisclosure).toBeVisible();
  await diagnosticsDisclosure.click();
  await expect(coordinatesDisclosure).toBeHidden();
  await diagnosticsDisclosure.click();
  await expect(coordinatesDisclosure).toBeVisible();
  await expect(page.getByText("На период разработки")).toBeVisible();
  await expect(page.getByText(/Её заменит выбор района/)).toBeVisible();
  const help = page.getByRole("button", {
    name: "Справка: Получить следующую страницу",
  });
  await help.click();
  const explanation = page.getByText(/Страница не является районом/);
  await expect(explanation).toBeVisible();
  await page.getByText("На период разработки").click();
  await expect(explanation).toBeHidden();
  await help.click();
  await expect(explanation).toBeVisible();
  await help.press("Escape");
  await expect(explanation).toBeHidden();
  await help.click();
  await help.press("Enter");
  await expect(explanation).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Обновить район сейчас", exact: true }),
  ).toBeDisabled();
});

test("administrator help loads detailed external guidance", async ({
  page,
}) => {
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    let body: unknown = { notices: [] };
    if (url.endsWith("/api/v1/sources")) body = { sources: [] };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("http://127.0.0.1:5174");
  await page.getByRole("button", { name: "Помощь" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Руководство по административной панели",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /Диагностическая постраничная загрузка/,
    }),
  ).toBeVisible();
  await expect(page.getByText(/SOURCE_THROTTLED/).first()).toBeVisible();
  await page.getByRole("combobox", { name: "Язык" }).selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Administrator guide" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /District cache — planned/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open data collection" }).click();
  await expect(
    page.getByRole("heading", { name: "Data collection" }),
  ).toBeVisible();
});

test("operator map and preview summary are separate from diagnostic import", async ({
  page,
}) => {
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    const body: unknown = url.endsWith("/api/v1/sources")
      ? { sources: [] }
      : { notices: [] };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("http://127.0.0.1:5174");
  await expect(
    page.getByRole("heading", { name: "Карта и анализ" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Краткая статистика" }),
  ).toBeVisible();
  await expect(page.getByText(/только записи, полученные/i)).toBeVisible();
  await page.getByRole("button", { name: "Загрузка данных" }).click();
  await expect(
    page.getByRole("region", { name: "Краткая статистика" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Карта и анализ" }).click();
  await expect(
    page.getByRole("region", { name: "Краткая статистика" }),
  ).toBeVisible();
});
