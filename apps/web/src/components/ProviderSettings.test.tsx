// Feature IDs: SOURCES.PROVIDER_CONFIGURATION
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProviderSettings } from "./ProviderSettings";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const status = {
  sourceConfigured: true,
  latestRun: null,
  pendingReview: 0,
  pendingWithGeometry: 0,
  verifiedWithGeometry: 0,
  missingGeometry: 0,
};

const config = {
  providerName: "Test provider",
  endpoint: "https://example.org/plans",
  request: {
    method: "POST",
    regionParameter: "subject",
    regionCode: 55,
    parameters: {},
  },
  revision: "1",
  collectionEnabled: false,
};

it("requires an operator token and submits edited parameters to the backend", async () => {
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
    if (_url === "/api/v1/operator/provider/status") {
      return new Response(JSON.stringify(status));
    }
    if (init?.method === "PUT") {
      const edited = JSON.parse(String(init.body));
      expect(edited.request.regionCode).toBe(67);
      expect(edited.providerName).toBe("Test provider");
      expect(edited.request.regionContainer).toBe("beekeperSearchFilter");
      expect(init.headers).toMatchObject({
        Authorization: "Bearer test-operator",
      });
      // A successful API response is the public configuration contract, not the PUT request body.
      // In particular, expectedRevision is a write-only concurrency precondition.
      return new Response(
        JSON.stringify({
          ...config,
          providerName: edited.providerName,
          endpoint: edited.endpoint,
          request: edited.request,
          revision: "2",
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify(config), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<ProviderSettings />);
  expect(screen.queryByLabelText("Адрес API источника")).toBeNull();
  fireEvent.change(screen.getByLabelText("Токен оператора"), {
    target: { value: "test-operator" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Открыть настройки" }));
  expect(await screen.findByLabelText("Адрес API источника")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Код региона"), {
    target: { value: "67" },
  });
  fireEvent.change(screen.getByLabelText("Объект фильтра региона"), {
    target: { value: "beekeperSearchFilter" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Сохранить конфигурацию" }),
  );
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  expect(
    await screen.findByText(
      /Конфигурация сохранена\. Можно загрузить страницу вручную/,
    ),
  ).toBeTruthy();
  expect((screen.getByLabelText("Код региона") as HTMLInputElement).value).toBe(
    "67",
  );
  expect(
    screen.getByRole("button", { name: "Загрузить одну страницу" }),
  ).toBeTruthy();
});

it("does not expose settings after credentials are changed", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(config), { status: 200 })),
  );
  render(<ProviderSettings />);
  fireEvent.change(screen.getByLabelText("Токен оператора"), {
    target: { value: "old-token" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Открыть настройки" }));
  expect(await screen.findByLabelText("Адрес API источника")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Токен оператора"), {
    target: { value: "new-token" },
  });
  expect(screen.queryByLabelText("Адрес API источника")).toBeNull();
});

it("discards an in-flight settings response after the operator token changes", async () => {
  let respond: ((value: Response) => void) | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          respond = resolve;
        }),
    ),
  );
  render(<ProviderSettings />);
  fireEvent.change(screen.getByLabelText("Токен оператора"), {
    target: { value: "old-token" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Открыть настройки" }));
  fireEvent.change(screen.getByLabelText("Токен оператора"), {
    target: { value: "new-token" },
  });
  respond?.(new Response(JSON.stringify(config), { status: 200 }));
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Открыть настройки" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  expect(screen.queryByLabelText("Адрес API источника")).toBeNull();
});

it("shows a failed manual sync without requesting permission evidence", async () => {
  const fetcher = vi.fn(
    async (path: string) =>
      new Response(
        JSON.stringify(
          path === "/api/v1/operator/provider/status"
            ? {
                ...status,
                pendingReview: 2,
                pendingWithGeometry: 1,
                missingGeometry: 1,
                latestRun: {
                  status: "failed",
                  startedAt: "2026-11-01T12:00:00.000Z",
                  completedAt: "2026-11-01T12:00:02.000Z",
                  received: 0,
                  accepted: 0,
                  errorCode: "UPSTREAM_STATUS",
                },
              }
            : config,
        ),
      ),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<ProviderSettings />);
  fireEvent.change(screen.getByLabelText("Токен оператора"), {
    target: { value: "test-operator" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Открыть настройки" }));
  expect(
    await screen.findByText(/Ожидают проверки: 2; с полигонами: 1/),
  ).toBeTruthy();
  expect(screen.getByText(/UPSTREAM_STATUS/)).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Загрузить одну страницу" }),
  ).toBeTruthy();
  expect(screen.queryByLabelText("Ссылка на разрешение")).toBeNull();
});

it("allows the operator to fetch immediately without access approval", async () => {
  let syncCount = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      if (
        path === "/api/v1/operator/provider/sync" &&
        init?.method === "POST"
      ) {
        syncCount++;
        return new Response(
          JSON.stringify({ received: 2, stored: 2, nextPage: 1 }),
        );
      }
      if (path === "/api/v1/operator/notices") {
        return new Response(JSON.stringify({ notices: [] }));
      }
      if (path === "/api/v1/operator/provider/status") {
        return new Response(JSON.stringify(status));
      }
      return new Response(JSON.stringify(config));
    }),
  );
  render(<ProviderSettings />);
  fireEvent.change(screen.getByLabelText("Токен оператора"), {
    target: { value: "test-operator" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Открыть настройки" }));
  const button = await screen.findByRole("button", {
    name: "Загрузить одну страницу",
  });
  expect(screen.queryByText(/Подтвердить проверенный доступ/)).toBeNull();
  fireEvent.click(button);
  await waitFor(() => expect(syncCount).toBe(1));
  expect(await screen.findByText(/Страница получена: 2/)).toBeTruthy();
});

it("disables manual fetching when the provider is not configured", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (path: string) =>
        new Response(
          JSON.stringify(
            path === "/api/v1/operator/provider/status"
              ? { ...status, sourceConfigured: false }
              : config,
          ),
        ),
    ),
  );
  render(<ProviderSettings />);
  fireEvent.change(screen.getByLabelText("Токен оператора"), {
    target: { value: "test-operator" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Открыть настройки" }));
  const button = await screen.findByRole("button", {
    name: "Загрузить одну страницу",
  });
  expect(button.hasAttribute("disabled")).toBe(true);
});

it("requires a reviewer identity and evidence note before publishing a fetched polygon", async () => {
  const observationId = "11111111-2222-4333-8444-555555555555";
  let reviewed = false;
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/api/v1/operator/provider/status") {
      return new Response(
        JSON.stringify({ ...status, pendingReview: 1, pendingWithGeometry: 1 }),
      );
    }
    if (path === "/api/v1/operator/notices") {
      return new Response(
        JSON.stringify({
          notices: reviewed
            ? []
            : [
                {
                  id: observationId,
                  sourceUrl: "https://example.org/plans",
                  retrievedAt: "2026-11-01T12:00:00.000Z",
                  contractorName: "Fixture grower",
                  cadastralNumber: "67:01:0000000:42",
                  geometryAvailable: true,
                  startAt: null,
                  endAt: null,
                  treatments: [],
                },
              ],
        }),
      );
    }
    if (path === `/api/v1/operator/notices/${observationId}/review`) {
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer test-operator",
      });
      expect(JSON.parse(String(init?.body))).toEqual({
        decision: "verified",
        reviewer: "Test reviewer",
        evidenceNote: "Compared geometry with the original document.",
      });
      reviewed = true;
      return new Response(JSON.stringify({ status: "verified" }));
    }
    return new Response(JSON.stringify(config));
  });
  vi.stubGlobal("fetch", fetcher);

  render(<ProviderSettings />);
  fireEvent.change(screen.getByLabelText("Токен оператора"), {
    target: { value: "test-operator" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Открыть настройки" }));
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Показать ожидающие проверки записи",
    }),
  );

  const confirm = await screen.findByRole("button", {
    name: "Подтвердить и опубликовать",
  });
  expect(confirm.hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByLabelText("Имя проверяющего"), {
    target: { value: "Test reviewer" },
  });
  expect(confirm.hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByLabelText("Основание проверки записи"), {
    target: { value: "Compared geometry with the original document." },
  });
  expect(confirm.hasAttribute("disabled")).toBe(false);
  fireEvent.click(confirm);
  await waitFor(() => expect(reviewed).toBe(true));
});
