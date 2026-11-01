// Feature IDs: MAP.POINT_SELECTION, SOURCES.CATALOG, WEATHER.POINT_FORECAST
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./components/MapCanvas", () => ({
  MapCanvas: ({
    onSelect,
  }: {
    onSelect: (point: { lat: number; lon: number }) => void;
  }) => (
    <button
      aria-label="Select fixture location"
      onClick={() => onSelect({ lat: 54.78, lon: 32.05 })}
    >
      Map fixture
    </button>
  ),
}));

const forecast = {
  point: { lat: 54.78, lon: 32.05 },
  weather: {
    temperatureC: 10,
    relativeHumidityPct: 75,
    windSpeedMs: 1.5,
    windDirectionDeg: 90,
    precipitationMm: 0.1,
  },
  provenance: {
    sourceId: "test-forecast",
    sourceName: "Synthetic test source",
    sourceUrl: "https://example.invalid/test",
    observedAt: "2026-10-31T08:00:00.000Z",
    retrievedAt: "2026-10-31T08:03:00.000Z",
    nature: "forecast_model",
  },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("renders a map-centered empty state without fictional observations", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ sources: [] }), { status: 200 }),
    ),
  );
  render(<App />);
  expect(screen.getByText("Выберите точку карты")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Select fixture location" }),
  ).toBeTruthy();
  expect(await screen.findByText("Карта и обзор территории")).toBeTruthy();
});

it("shows a source failure and recovers after user retry without fallback values", async () => {
  let attempts = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/v1/sources") {
        return new Response(JSON.stringify({ sources: [] }));
      }
      attempts += 1;
      if (attempts === 1) {
        return new Response(
          JSON.stringify({
            error: {
              code: "SOURCE_UNAVAILABLE",
              message: "Source unavailable",
              requestId: "request-1",
            },
          }),
          { status: 503 },
        );
      }
      return new Response(JSON.stringify(forecast));
    }),
  );

  render(<App />);
  fireEvent.click(
    screen.getByRole("button", { name: "Select fixture location" }),
  );
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("10.0 °C")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Повторить запрос" }));
  expect(await screen.findByText("10.0 °C")).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: /Synthetic test source/ })
      .getAttribute("href"),
  ).toBe("https://example.invalid/test");
  expect(attempts).toBe(2);
});

it("reports source catalog failure instead of a fake empty catalog", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "SOURCE_UNAVAILABLE",
              message: "Database offline",
              requestId: "request-2",
            },
          }),
          { status: 503 },
        ),
    ),
  );

  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /Посмотреть источники/ }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("Подключённые источники отсутствуют.")).toBeNull();
});

it("shows the seeded treatment provider publicly without operator credentials", async () => {
  const source = {
    id: "treatment-feed",
    name: "Fixture treatment feed",
    kind: "treatment",
    lifecycle: "under_review",
    url: "https://provider.example.org/api/treatments",
    termsReview: "pending",
    lastSuccessfulIngestAt: null,
  };
  const fetcher = vi.fn(async () =>
    new Response(JSON.stringify({ sources: [source] }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Настройки источника" }));
  expect(await screen.findByText("Fixture treatment feed")).toBeTruthy();
  expect(screen.getByText(source.url)).toBeTruthy();
  expect(screen.getByText("На проверке")).toBeTruthy();
  expect(screen.getByText("Не выполнялась")).toBeTruthy();
  expect(
    screen.getByText(/Импорт планов и их отображение на карте пока не/),
  ).toBeTruthy();
  expect(screen.queryByLabelText("Адрес API источника")).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith("/api/v1/sources", expect.any(Object));
});

it("shows a missing treatment provider instead of inventing settings", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ sources: [] }))),
  );
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Настройки источника" }));
  expect(
    await screen.findByText(/Источник обработок не найден в реестре/),
  ).toBeTruthy();
  expect(screen.queryByLabelText("Адрес API источника")).toBeNull();
});
