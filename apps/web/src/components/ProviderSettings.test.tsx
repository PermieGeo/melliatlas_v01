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
  accessDecision: "pending",
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
  accessDecision: "pending",
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
    await screen.findByText(/Автоматическая загрузка отключена/),
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

it("explains why no map layer is available before access review and shows the last failed sync", async () => {
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
  expect(screen.getByText(/требуется подтверждённое основание/)).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Загрузить одну страницу" }),
  ).toBeNull();
});

it("offers the manual fetch action as soon as operator approval succeeds", async () => {
  let approved = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      if (
        path === "/api/v1/operator/provider/approve" &&
        init?.method === "POST"
      ) {
        approved = true;
        return new Response(JSON.stringify({ status: "reviewed" }));
      }
      if (path === "/api/v1/operator/provider/status") {
        return new Response(
          JSON.stringify({
            ...status,
            accessDecision: approved ? "approved" : "pending",
          }),
        );
      }
      return new Response(
        JSON.stringify({
          ...config,
          accessDecision: approved ? "approved" : "pending",
        }),
      );
    }),
  );
  render(<ProviderSettings />);
  fireEvent.change(screen.getByLabelText("Токен оператора"), {
    target: { value: "test-operator" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Открыть настройки" }));
  expect(await screen.findByLabelText("Имя проверяющего")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Имя проверяющего"), {
    target: { value: "Test reviewer" },
  });
  fireEvent.change(screen.getByLabelText("Ссылка на разрешение"), {
    target: { value: "https://publisher.example.org/terms" },
  });
  fireEvent.change(screen.getByLabelText("Обоснование доступа"), {
    target: { value: "Synthetic operator permission fixture for UI only." },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Подтвердить проверенный доступ" }),
  );
  expect(
    await screen.findByRole("button", { name: "Загрузить одну страницу" }),
  ).toBeTruthy();
  expect(screen.getByText(/Теперь можно загрузить страницу/)).toBeTruthy();
});
