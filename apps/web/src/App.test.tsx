// Feature IDs: MAP.POINT_SELECTION, WEATHER.POINT_FORECAST
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
    onSelectTreatment,
    onViewportChange,
    treatments,
  }: {
    onSelect(point: { lat: number; lon: number }): void;
    onSelectTreatment(
      treatment: import("@melliatlas/contracts").MapTreatment,
    ): void;
    onViewportChange(bbox: [number, number, number, number]): void;
    treatments: import("@melliatlas/contracts").MapTreatment[];
  }) => {
    useEffect(() => {
      onViewportChange([31, 53, 33, 55]);
    }, [onViewportChange]);
    return (
      <div>
        <button onClick={() => onSelect({ lat: 54.78, lon: 32.05 })}>
          Select fixture location
        </button>
        {treatments[0] && (
          <button onClick={() => onSelectTreatment(treatments[0])}>
            Select fixture treatment
          </button>
        )}
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
      if (!url.startsWith("/api/v1/locations/inspect?"))
        return new Response(null, { status: 404 });
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

it("shows selected source treatments beside compact weather with separate cadastral entries", async () => {
  const treatment = {
    id: "00000000-0000-4000-8000-000000000031",
    sourceName: "Fixture Saturn",
    sourceUrl: "https://example.invalid/plans",
    retrievedAt: "2026-11-01T08:00:00.000Z",
    publishedAt: null,
    startAt: "2026-11-10T08:00:00.000Z",
    endAt: "2026-11-12T08:00:00.000Z",
    contractorName: "Example farmer",
    cadastralNumber: "67:01:0000001:100; 67:01:0000001:101",
    treatments: [{ name: "Example pesticide", crop: "Rye", beeHazardClass: 2 }],
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [32, 54.7],
          [32.1, 54.7],
          [32.1, 54.8],
          [32, 54.7],
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
            ? { notices: [treatment] }
            : forecast,
        ),
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<App />);
  await screen.findByText("Features: 1");
  fireEvent.click(screen.getByText("Select fixture treatment"));
  const panel = screen.getByRole("region", { name: "Информация об участке" });
  expect(panel.textContent).toContain("Example farmer");
  expect(panel.textContent).toContain("Example pesticide");
  expect(panel.textContent).toContain("Класс опасности для пчёл");
  expect(
    panel.querySelectorAll('[data-testid="cadastral-list"] li'),
  ).toHaveLength(2);
  expect(panel.textContent).toContain("67:01:0000001:101");
  expect(
    fetcher.mock.calls.filter(([url]) => url.includes("locations/inspect")),
  ).toHaveLength(0);
  fireEvent.click(
    screen.getByRole("button", { name: "Закрыть сведения об участке" }),
  );
  expect(panel.textContent).toContain("Выберите поле на карте");
});

it("loads both help languages from external files without requesting operator data", async () => {
  const fetcher = vi.fn(async (url: string) => {
    if (url.startsWith("/help/")) {
      const locale = url.includes("/en.json") ? "en" : "ru";
      return new Response(
        JSON.stringify({
          version: 1,
          locale,
          title:
            locale === "ru"
              ? "Как пользоваться MelliAtlas"
              : "Using MelliAtlas",
          intro: "Fixture introduction",
          sections: [
            {
              id: "map",
              title: "Map guide",
              paragraphs: ["How map fields work"],
            },
          ],
          example: {
            id: "demo",
            title: "Demo example",
            paragraphs: ["This example is fictional"],
          },
          warningsTitle: "Warnings",
          warnings: ["Not a safety verdict"],
        }),
      );
    }
    return new Response(
      JSON.stringify(
        url.startsWith("/api/v1/notices?bbox=") ? { notices: [] } : forecast,
      ),
    );
  });
  vi.stubGlobal("fetch", fetcher);
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Помощь" }));
  expect(
    await screen.findByRole("heading", { name: "Как пользоваться MelliAtlas" }),
  ).toBeTruthy();
  expect(screen.getByText("This example is fictional")).toBeTruthy();
  expect(screen.queryByText("Features: 0")).toBeNull();
  fireEvent.change(screen.getByLabelText("Язык"), { target: { value: "en" } });
  expect(
    await screen.findByRole("heading", { name: "Using MelliAtlas" }),
  ).toBeTruthy();
  expect(
    fetcher.mock.calls
      .filter(([url]) => url.startsWith("/help/"))
      .map(([url]) => url),
  ).toEqual(["/help/ru.json", "/help/en.json"]);
  fireEvent.click(screen.getByRole("button", { name: "Return to map" }));
  expect(await screen.findByText("Features: 0")).toBeTruthy();
  expect(fetcher.mock.calls.some(([url]) => url.includes("/operator/"))).toBe(
    false,
  );
});
