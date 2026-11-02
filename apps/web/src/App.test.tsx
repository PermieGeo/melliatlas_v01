import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useEffect } from "react";
import App from "./App";

vi.mock("./components/MapCanvas", () => ({
  MapCanvas: ({
    onSelect,
    onViewportChange,
    treatments,
  }: {
    onSelect(point: { lat: number; lon: number }): void;
    onViewportChange(bbox: [number, number, number, number]): void;
    treatments: unknown[];
  }) => {
    useEffect(() => {
      onViewportChange([31, 53, 33, 55]);
    }, [onViewportChange]);
    return (
      <div>
        <button onClick={() => onSelect({ lat: 54.78, lon: 32.05 })}>
          Select fixture location
        </button>
        <span>Features: {treatments.length}</span>
      </div>
    );
  },
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
    sourceId: "test",
    sourceName: "Test weather",
    sourceUrl: "https://example.invalid/forecast",
    observedAt: "2026-10-31T08:00:00.000Z",
    retrievedAt: "2026-10-31T08:03:00.000Z",
    nature: "forecast_model",
  },
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("reads the public attributed map endpoint without accessing administrator routes", async () => {
  const fetcher = vi.fn(async (url: string) => {
    if (url.startsWith("/api/v1/notices?bbox="))
      return new Response(JSON.stringify({ notices: [] }));
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<App />);
  expect(await screen.findByText(/Полигонов обработок пока нет/)).toBeTruthy();
  expect(screen.getByText("Features: 0")).toBeTruthy();
  expect(screen.queryByText("Конфигурация")).toBeNull();
  expect(
    fetcher.mock.calls.some(([url]) => url.startsWith("/api/v1/notices?bbox=")),
  ).toBe(true);
  expect(fetcher.mock.calls.every(([url]) => !url.includes("/operator/"))).toBe(
    true,
  );
});

it("loads attributed forecast on selection and supports translation", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.startsWith("/api/v1/notices?bbox=")
              ? { notices: [] }
              : forecast,
          ),
        ),
    ),
  );
  render(<App />);
  fireEvent.click(screen.getByText("Select fixture location"));
  expect(await screen.findByText("10.0 °C")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: /Test weather/ }).getAttribute("href"),
  ).toBe(forecast.provenance.sourceUrl);
  fireEvent.change(screen.getByLabelText("Язык"), { target: { value: "en" } });
  expect(screen.getByRole("heading", { name: "Treatment map" })).toBeTruthy();
});

it("does not invent forecast data after failed fetch and allows retry", async () => {
  let attempts = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.startsWith("/api/v1/notices?bbox="))
        return new Response(JSON.stringify({ notices: [] }));
      attempts += 1;
      if (attempts === 1)
        return new Response(
          JSON.stringify({
            error: {
              code: "SOURCE_UNAVAILABLE",
              message: "Offline",
              requestId: "test",
            },
          }),
          { status: 503 },
        );
      return new Response(JSON.stringify(forecast));
    }),
  );
  render(<App />);
  fireEvent.click(screen.getByText("Select fixture location"));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("10.0 °C")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
  await waitFor(() => expect(screen.getByText("10.0 °C")).toBeTruthy());
  expect(attempts).toBe(2);
});

it("renders an unreviewed structured map feature without requiring admin access", async () => {
  const pending = {
    id: "00000000-0000-4000-8000-000000000011",
    sourceName: "Fixture treatment source",
    sourceUrl: "https://example.invalid/plans",
    retrievedAt: "2026-11-01T08:00:00.000Z",
    publishedAt: null,
    startAt: null,
    endAt: null,
    contractorName: null,
    cadastralNumber: null,
    treatments: [],
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [32.0, 54.7],
          [32.1, 54.7],
          [32.1, 54.8],
          [32.0, 54.7],
        ],
      ],
    },
    spatialPrecision: "exact_polygon",
    reviewStatus: "pending",
  };
  const fetcher = vi.fn(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.startsWith("/api/v1/notices?bbox=")
            ? { notices: [pending] }
            : forecast,
        ),
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<App />);
  expect(await screen.findByText("Features: 1")).toBeTruthy();
  expect(
    screen.getAllByText(/включая записи без независимой проверки/),
  ).toHaveLength(2);
  expect(fetcher.mock.calls.every(([url]) => !url.includes("/operator/"))).toBe(
    true,
  );
});
