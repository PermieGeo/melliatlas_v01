// Feature IDs: MAP.POINT_SELECTION, UX.MOBILE_MAP, WEATHER.POINT_FORECAST
import { expect, test } from "@playwright/test";

test("map selection displays attributed weather and works on mobile", async ({
  page,
}) => {
  await page.route("**/api/v1/sources", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ sources: [] }),
    });
  });

  await page.route("**/api/v1/locations/inspect?**", async (route) => {
    const requestUrl = new URL(route.request().url());
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        point: {
          lat: Number(requestUrl.searchParams.get("lat")),
          lon: Number(requestUrl.searchParams.get("lon")),
        },
        weather: {
          temperatureC: 10,
          relativeHumidityPct: 75,
          windSpeedMs: 1.5,
          windDirectionDeg: 90,
          precipitationMm: 0.1,
        },
        provenance: {
          sourceId: "test-fixture",
          sourceName: "Synthetic test source",
          sourceUrl: "https://example.invalid/synthetic-source",
          observedAt: "2026-10-31T08:00:00.000Z",
          retrievedAt: "2026-10-31T08:03:00.000Z",
          nature: "forecast_model",
        },
      }),
    });
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Карта и обзор территории" }),
  ).toBeVisible();
  await page
    .locator(".leaflet-container")
    .click({ position: { x: 120, y: 120 } });
  await expect(page.getByText("10.0 °C")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Synthetic test source/ }),
  ).toBeVisible();
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(horizontalOverflow).toBe(false);
});

test("failed weather request shows an error and user retry loads actual response", async ({
  page,
}) => {
  await page.route("**/api/v1/sources", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ sources: [] }),
    });
  });

  let attempts = 0;
  await page.route("**/api/v1/locations/inspect?**", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "SOURCE_UNAVAILABLE",
            message: "Upstream failure",
            requestId: "fixture-request",
          },
        }),
      });
      return;
    }
    const requestUrl = new URL(route.request().url());
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        point: {
          lat: Number(requestUrl.searchParams.get("lat")),
          lon: Number(requestUrl.searchParams.get("lon")),
        },
        weather: {
          temperatureC: 6.5,
          relativeHumidityPct: 80,
          windSpeedMs: 2,
          windDirectionDeg: 180,
          precipitationMm: 0,
        },
        provenance: {
          sourceId: "fixture-recovery",
          sourceName: "Recovery test source",
          sourceUrl: "https://example.invalid/recovered",
          observedAt: "2026-10-31T08:00:00.000Z",
          retrievedAt: "2026-10-31T08:01:00.000Z",
          nature: "forecast_model",
        },
      }),
    });
  });

  await page.goto("/");
  await page
    .locator(".leaflet-container")
    .click({ position: { x: 120, y: 120 } });
  await expect(page.getByRole("alert")).toContainText(
    "Источник временно недоступен",
  );
  await expect(page.getByText("6.5 °C")).toHaveCount(0);
  await page.getByRole("button", { name: "Повторить запрос" }).click();
  await expect(page.getByText("6.5 °C")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Recovery test source/ }),
  ).toHaveAttribute("href", "https://example.invalid/recovered");
  expect(attempts).toBe(2);
});
