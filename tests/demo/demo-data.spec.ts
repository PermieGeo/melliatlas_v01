// Feature IDs: NOTICES.MAP_OVERLAY, SOURCES.DOCUMENT_HISTORY
import { expect, test } from "@playwright/test";

type Notice = {
  id: string;
  reviewStatus: "pending" | "verified";
  sourceName: string;
  sourceUrl: string;
};
const API = "http://127.0.0.1:3001";

/** Test actual PostGIS -> API -> UI behavior without replacing notice HTTP responses. */
test("synthetic treatments are served by the real map API and shown on the map", async ({
  page,
  request,
}) => {
  await expect
    .poll(async () => (await request.get(`${API}/health/ready`)).status())
    .toBe(200);
  const response = await request.get(
    `${API}/api/v1/notices?bbox=31.7,54.6,32.5,55.0`,
  );
  expect(response.ok()).toBe(true);
  const payload = (await response.json()) as { notices: Notice[] };
  expect(payload.notices).toHaveLength(10);
  expect(
    payload.notices.every((item) => item.sourceName.startsWith("DEMO —")),
  ).toBe(true);
  expect(
    payload.notices.every((item) =>
      new URL(item.sourceUrl).hostname.endsWith(".invalid"),
    ),
  ).toBe(true);
  expect(payload.notices.some((item) => item.reviewStatus === "verified")).toBe(
    true,
  );
  expect(payload.notices.some((item) => item.reviewStatus === "pending")).toBe(
    true,
  );
  expect(payload.notices.some((item) => item.id.endsWith("000005"))).toBe(
    false,
  );
  expect(payload.notices.some((item) => item.id.endsWith("000011"))).toBe(
    false,
  );

  await page.goto("/");
  await expect(page.getByText(/ДЕМОДАННЫЕ: все поля/)).toBeVisible();
  await expect(page.getByText(/Полигонов: [1-9]/)).toBeVisible();
  const polygons = page.locator(
    ".leaflet-overlay-pane path.leaflet-interactive",
  );
  await expect(polygons.first()).toBeVisible();
  await polygons.first().click();
  await expect(page.locator(".leaflet-popup")).toHaveCount(0);
  const details = page.getByRole("region", { name: "Информация об участке" });
  await expect(
    details.getByText(/DEMO agricultural cooperative/),
  ).toBeVisible();
  await expect(details.getByText(/DEMO-PARCEL-/)).toBeVisible();
  await expect(
    details.getByText("DEMO — SYNTHETIC DATA (NOT SATURN)"),
  ).toBeVisible();
});

test("administrator sees persisted synthetic pending and reviewed records", async ({
  page,
  request,
}) => {
  await expect
    .poll(async () => (await request.get(`${API}/health/ready`)).status())
    .toBe(200);
  const response = await request.get(`${API}/api/v1/operator/provider/status`);
  expect(response.ok()).toBe(true);
  const status = (await response.json()) as {
    pendingReview: number;
    pendingWithGeometry: number;
    verifiedWithGeometry: number;
  };
  expect(status.pendingReview).toBe(7);
  expect(status.pendingWithGeometry).toBe(6);
  expect(status.verifiedWithGeometry).toBe(4);

  await expect
    .poll(async () => (await request.get("http://127.0.0.1:5174")).status())
    .toBe(200);
  await page.goto("http://127.0.0.1:5174");
  await expect(page.getByText(/ДЕМОДАННЫЕ: все записи/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Карта и анализ" }),
  ).toBeVisible();
  const analysis = page.getByRole("region", { name: "Краткая статистика" });
  await expect(analysis.getByText("Записей на карте")).toBeVisible();
  await expect(analysis.getByText("10", { exact: true })).toBeVisible();
  const polygons = page.locator(
    ".leaflet-overlay-pane path.leaflet-interactive",
  );
  await expect(polygons.first()).toBeVisible();
  await polygons.first().click();
  const fieldDetails = page.getByRole("complementary", {
    name: "Информация об участке",
  });
  await expect(
    fieldDetails.getByText(/DEMO agricultural cooperative/),
  ).toBeVisible();
  await expect(fieldDetails.getByText(/DEMO-PARCEL-/)).toBeVisible();
  await expect(page.locator(".leaflet-popup")).toHaveCount(0);
  await page.getByRole("button", { name: "Проверка записей" }).click();
  await expect(
    page.getByRole("heading", { name: "Проверка записей" }),
  ).toBeVisible();
  await expect(
    page.getByText("DEMO agricultural cooperative 02"),
  ).toBeVisible();
  await expect(
    page.getByText("DEMO agricultural cooperative 11"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Источники" }).click();
  await expect(
    page.getByText("DEMO — SYNTHETIC DATA (NOT SATURN)"),
  ).toBeVisible();
});
