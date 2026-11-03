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

test("beekeeper map only reads the public source-attributed notice endpoint", async ({
  page,
}) => {
  const requested: string[] = [];
  await page.route("**/api/v1/notices**", async (route) => {
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
  await expect(page.getByText(/Полигонов обработок пока нет/)).toBeVisible();
  expect(requested.length).toBeGreaterThan(0);
  expect(requested.every((url) => !url.includes("operator"))).toBe(true);
  await expect(page.getByText("Конфигурация")).toHaveCount(0);
});

test("map selection shows attributed forecast with a localized retry", async ({
  page,
}) => {
  await page.route("**/api/v1/notices**", async (route) =>
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

test("public map displays unreviewed sourced polygons without an administrator API call", async ({
  page,
}) => {
  const requests: string[] = [];
  const pending = {
    id: "00000000-0000-4000-8000-000000000021",
    sourceName: "Fixture publisher",
    sourceUrl: "https://example.invalid/plans",
    retrievedAt: "2026-11-01T08:00:00.000Z",
    publishedAt: null,
    startAt: null,
    endAt: null,
    contractorName: null,
    cadastralNumber: "67:01:0000001:100;67:01:0000001:101",
    treatments: [{ name: "Test product", crop: "Rye", beeHazardClass: 2 }],
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [32.0, 54.75],
          [32.09, 54.75],
          [32.09, 54.82],
          [32.0, 54.82],
          [32.0, 54.75],
        ],
      ],
    },
    spatialPrecision: "exact_polygon",
    reviewStatus: "pending",
  };
  await page.route("**/api/v1/notices**", async (route) => {
    requests.push(route.request().url());
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ notices: [pending] }),
    });
  });
  await page.goto("/");
  await expect(page.getByText("Полигонов: 1")).toBeVisible();
  await expect(
    page.locator("aside").getByText(/без независимой проверки/),
  ).toBeVisible();
  const polygon = page.locator(
    ".leaflet-overlay-pane path.leaflet-interactive",
  );
  await expect(polygon).toHaveCount(1);
  await polygon.click();
  await expect(page.locator(".leaflet-popup")).toHaveCount(0);
  const details = page.getByRole("region", { name: "Информация об участке" });
  await expect(
    details.getByText("Не проверено. Не является оценкой безопасности."),
  ).toBeVisible();
  await expect(details.getByText("Test product")).toBeVisible();
  await expect(
    details.locator('[data-testid="cadastral-list"] li'),
  ).toHaveCount(2);
  await expect(
    page.getByRole("region", { name: "Погода в выбранной точке" }),
  ).toBeVisible();
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every((url) => !url.includes("operator"))).toBe(true);
});

test("beekeeper help loads the external guide and switches languages", async ({
  page,
}) => {
  const requested: string[] = [];
  await page.route("**/api/v1/notices**", async (route) => {
    requested.push(route.request().url());
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ notices: [] }),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Помощь" }).click();
  await expect(
    page.getByRole("heading", { name: "Как пользоваться MelliAtlas" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Начните с карты/ }),
  ).toBeVisible();
  await expect(page.getByText(/12 вымышленных записей/)).toBeVisible();
  await page.getByRole("combobox", { name: "Язык" }).selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Using MelliAtlas" }),
  ).toBeVisible();
  await expect(page.getByText(/12 synthetic records/)).toBeVisible();
  await page.getByRole("button", { name: "Return to map" }).click();
  await expect(
    page.getByRole("heading", { name: "Treatment map" }),
  ).toBeVisible();
  expect(requested.length).toBeGreaterThan(0);
  expect(requested.every((url) => !url.includes("/operator/"))).toBe(true);
});
