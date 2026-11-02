// Feature IDs: MAP.POINT_SELECTION, UX.MOBILE_MAP, WEATHER.POINT_FORECAST
import { expect, test } from "@playwright/test";

const forecast = (lat: number, lon: number) => ({
  point: { lat, lon },
  weather: {
    temperatureC: 10,
    relativeHumidityPct: 75,
    windSpeedMs: 1.5,
    windDirectionDeg: 90,
    precipitationMm: 0.1,
  },
  provenance: {
    sourceId: "fixture",
    sourceName: "Test weather",
    sourceUrl: "https://example.invalid/weather",
    observedAt: "2026-10-31T08:00:00.000Z",
    retrievedAt: "2026-10-31T08:03:00.000Z",
    nature: "forecast_model",
  },
});

test("beekeeper map only reads the public reviewed notice endpoint", async ({
  page,
}) => {
  const requested: string[] = [];
  await page.route("**/api/v1/notices", async (route) => {
    requested.push(route.request().url());
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ notices: [] }),
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Карта обработок" }),
  ).toBeVisible();
  await expect(page.getByText(/Проверенных полигонов пока нет/)).toBeVisible();
  expect(requested.length).toBeGreaterThan(0);
  expect(requested.every((url) => !url.includes("operator"))).toBe(true);
  await expect(page.getByText("Конфигурация")).toHaveCount(0);
});

test("map selection shows attributed forecast with a localized retry", async ({
  page,
}) => {
  await page.route("**/api/v1/notices", async (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ notices: [] }),
    }),
  );
  let attempts = 0;
  await page.route("**/api/v1/locations/inspect?**", async (route) => {
    attempts++;
    if (attempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "SOURCE_UNAVAILABLE",
            message: "offline",
            requestId: "fixture",
          },
        }),
      });
      return;
    }
    const url = new URL(route.request().url());
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        forecast(
          Number(url.searchParams.get("lat")),
          Number(url.searchParams.get("lon")),
        ),
      ),
    });
  });
  await page.goto("/");
  await page
    .locator(".leaflet-container")
    .click({ position: { x: 120, y: 120 } });
  await expect(page.getByRole("alert")).toContainText(
    "Метеоданные временно недоступны",
  );
  await page.getByRole("button", { name: "Повторить" }).click();
  await expect(page.getByText("10.0 °C")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Test weather/ }),
  ).toHaveAttribute("href", "https://example.invalid/weather");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1,
  );
  expect(overflow).toBe(false);
});
