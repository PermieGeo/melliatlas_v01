// Feature IDs: SOURCES.PROVIDER_CONFIGURATION, NOTICES.MAP_OVERLAY
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./components/MapPreview", () => ({
  MapPreview: () => <div>Map preview fixture</div>,
}));
const config = {
  providerName: "Fixture provider",
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
const status = {
  sourceConfigured: true,
  latestRun: null,
  pendingReview: 0,
  pendingWithGeometry: 0,
  verifiedWithGeometry: 0,
  missingGeometry: 0,
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps source configuration separate from explicit collection", async () => {
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === "/api/v1/sources")
      return new Response(JSON.stringify({ sources: [] }));
    if (url === "/api/v1/operator/notices/map-preview")
      return new Response(JSON.stringify({ notices: [] }));
    if (url === "/api/v1/operator/provider/status")
      return new Response(JSON.stringify(status));
    if (url === "/api/v1/operator/provider/region-scan")
      return new Response(
        JSON.stringify({ regionCode: 55, nextPage: 0, scan: null }),
      );
    if (url === "/api/v1/operator/provider" && options?.method === "PUT")
      return new Response(JSON.stringify({ ...config, revision: "2" }));
    if (url === "/api/v1/operator/provider")
      return new Response(JSON.stringify(config));
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Конфигурация" }));
  const save = await screen.findByRole("button", {
    name: "Сохранить конфигурацию",
  });
  fireEvent.click(save);
  expect(
    await screen.findByText(/Загрузка данных не запускалась/),
  ).toBeTruthy();
  expect(
    fetcher.mock.calls.some(
      ([url]) => url === "/api/v1/operator/provider/sync",
    ),
  ).toBe(false);
});

it("fetches one batch only when requested in the data collection section", async () => {
  let synced = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/v1/operator/provider/sync") {
        synced += 1;
        return new Response(
          JSON.stringify({ received: 3, stored: 2, nextPage: 1 }),
        );
      }
      if (url === "/api/v1/operator/provider/status")
        return new Response(JSON.stringify(status));
      if (url === "/api/v1/operator/provider/region-scan")
        return new Response(
          JSON.stringify({ regionCode: 55, nextPage: 0, scan: null }),
        );
      if (url === "/api/v1/operator/notices/map-preview")
        return new Response(JSON.stringify({ notices: [] }));
      if (url === "/api/v1/sources")
        return new Response(JSON.stringify({ sources: [] }));
      return new Response(null, { status: 404 });
    }),
  );
  render(<App />);
  const fetch = await screen.findByRole("button", {
    name: "Получить следующую страницу",
  });
  fireEvent.click(fetch);
  expect(await screen.findByText(/Получено записей: 3/)).toBeTruthy();
  expect(synced).toBe(1);
  expect(screen.getByText("На период разработки")).toBeTruthy();
  expect(screen.getByText(/Её заменит выбор района/)).toBeTruthy();
  const help = screen.getByRole("button", {
    name: "Справка: Следующая страница",
  });
  expect((help.closest("details") as HTMLDetailsElement).open).toBe(false);
  fireEvent.click(help);
  expect((help.closest("details") as HTMLDetailsElement).open).toBe(true);
  expect(screen.getByText(/технический курсор/)).toBeTruthy();
  fireEvent.click(help);
  expect((help.closest("details") as HTMLDetailsElement).open).toBe(false);
});

it("keeps unverified district refresh disabled and never invokes legacy region collection", async () => {
  const fetcher = vi.fn(async (url: string) => {
    if (url === "/api/v1/operator/provider/district-cache") {
      return new Response(
        JSON.stringify({ ttlHours: 24, refreshEnabled: false, entries: [] }),
      );
    }
    if (url === "/api/v1/operator/provider/status")
      return new Response(JSON.stringify(status));
    if (url === "/api/v1/operator/notices/map-preview")
      return new Response(JSON.stringify({ notices: [] }));
    if (url === "/api/v1/sources")
      return new Response(JSON.stringify({ sources: [] }));
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<App />);
  expect(
    await screen.findByText("Покрытие районов пока не подтверждено."),
  ).toBeTruthy();
  expect(
    (
      screen.getByRole("button", {
        name: "Обновить район сейчас",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(fetcher.mock.calls.some(([url]) => url.includes("region-scan"))).toBe(
    false,
  );
  expect(
    fetcher.mock.calls.some(([url]) => url.includes("district-cache/refresh")),
  ).toBe(false);
});

it("localizes contextual field help without changing provider settings", async () => {
  const fetcher = vi.fn(async (url: string) => {
    if (url === "/api/v1/operator/provider")
      return new Response(JSON.stringify(config));
    if (url === "/api/v1/operator/provider/status")
      return new Response(JSON.stringify(status));
    if (url === "/api/v1/operator/provider/district-cache")
      return new Response(
        JSON.stringify({ ttlHours: 24, refreshEnabled: false, entries: [] }),
      );
    if (url === "/api/v1/operator/notices/map-preview")
      return new Response(JSON.stringify({ notices: [] }));
    if (url === "/api/v1/sources")
      return new Response(JSON.stringify({ sources: [] }));
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Конфигурация" }));
  await screen.findByLabelText("Код региона поставщика");
  const ruHelp = screen.getByRole("button", {
    name: "Справка: Код региона поставщика",
  });
  fireEvent.click(ruHelp);
  expect((ruHelp.closest("details") as HTMLDetailsElement).open).toBe(true);
  expect(screen.getByText(/Внутренний код региона/)).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox", { name: "Язык" }), {
    target: { value: "en" },
  });
  expect(screen.getByText(/Provider-specific region identifier/)).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Help: Provider region code" }),
  ).toBeTruthy();
  expect(
    fetcher.mock.calls.some(
      ([url]) => url === "/api/v1/operator/provider/sync",
    ),
  ).toBe(false);
});

it("loads RU/EN operator help from separate files without source collection", async () => {
  const fetcher = vi.fn(async (url: string) => {
    if (url.startsWith("/help/")) {
      const locale = url.includes("/en.json") ? "en" : "ru";
      return new Response(
        JSON.stringify({
          version: 1,
          locale,
          title:
            locale === "ru"
              ? "Руководство по административной панели"
              : "Administrator guide",
          intro: "Fixture intro",
          sections: [
            {
              id: "collection",
              title: "Collection",
              paragraphs: ["A page is not a district"],
            },
          ],
          example: {
            id: "demo",
            title: "Demo data",
            paragraphs: ["Fictional records only"],
          },
          warningsTitle: "Security",
          warnings: ["Local only"],
        }),
      );
    }
    if (url === "/api/v1/operator/notices/map-preview")
      return new Response(JSON.stringify({ notices: [] }));
    if (url === "/api/v1/sources")
      return new Response(JSON.stringify({ sources: [] }));
    if (url === "/api/v1/operator/provider/status")
      return new Response(JSON.stringify(status));
    if (url === "/api/v1/operator/provider/district-cache")
      return new Response(
        JSON.stringify({ ttlHours: 24, refreshEnabled: false, entries: [] }),
      );
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Помощь" }));
  expect(
    await screen.findByRole("heading", {
      name: "Руководство по административной панели",
    }),
  ).toBeTruthy();
  expect(screen.getByText("Fictional records only")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Язык"), { target: { value: "en" } });
  expect(
    await screen.findByRole("heading", { name: "Administrator guide" }),
  ).toBeTruthy();
  expect(
    fetcher.mock.calls
      .filter(([url]) => url.startsWith("/help/"))
      .map(([url]) => url),
  ).toEqual(["/help/ru.json", "/help/en.json"]);
  fireEvent.click(screen.getByRole("button", { name: "Open data collection" }));
  expect(screen.getByRole("heading", { name: "Data collection" })).toBeTruthy();
  expect(fetcher.mock.calls.some(([url]) => url.includes("/sync"))).toBe(false);
});
