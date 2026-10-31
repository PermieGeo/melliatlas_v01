// Feature IDs: SRC-01
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
