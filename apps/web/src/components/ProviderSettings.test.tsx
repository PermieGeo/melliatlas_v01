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

const configuration = {
  providerName: "Test provider",
  endpoint: "https://example.org/plans",
  request: {
    method: "POST",
    regionParameter: "subject",
    regionCode: 55,
    parameters: { pageNumber: 0, pageSize: 1 },
  },
  revision: "1",
  collectionEnabled: false,
};
const status = {
  sourceConfigured: true,
  latestRun: null,
  pendingReview: 0,
  pendingWithGeometry: 0,
  verifiedWithGeometry: 0,
  missingGeometry: 0,
};

it("loads settings automatically and saves and fetches one page without credentials", async () => {
  let saved = false;
  let synced = false;
  const onPublished = vi.fn();
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/api/v1/operator/provider/status")
      return new Response(JSON.stringify(status));
    if (path === "/api/v1/operator/provider" && init?.method === "PUT") {
      expect(init.headers).not.toHaveProperty("Authorization");
      const edited = JSON.parse(String(init.body));
      expect(edited.request.regionCode).toBe(67);
      expect(edited.expectedRevision).toBe("1");
      saved = true;
      return new Response(
        JSON.stringify({
          ...configuration,
          request: edited.request,
          revision: "2",
        }),
      );
    }
    if (path === "/api/v1/operator/provider/sync") {
      expect(saved).toBe(true);
      expect(init?.method).toBe("POST");
      synced = true;
      return new Response(
        JSON.stringify({ received: 1, stored: 1, nextPage: 0 }),
      );
    }
    if (path === "/api/v1/operator/notices")
      return new Response(JSON.stringify({ notices: [] }));
    return new Response(JSON.stringify(configuration));
  });
  vi.stubGlobal("fetch", fetcher);
  render(<ProviderSettings onPublished={onPublished} />);
  expect(screen.queryByLabelText("Токен оператора")).toBeNull();
  fireEvent.change(await screen.findByLabelText("Код региона"), {
    target: { value: "67" },
  });
  await waitFor(() =>
    expect(
      screen
        .getByRole("button", { name: "Сохранить и загрузить страницу" })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Сохранить и загрузить страницу" }),
  );
  await waitFor(() => expect(synced).toBe(true));
  expect(await screen.findByText(/Получено записей: 1/)).toBeTruthy();
  expect(onPublished).toHaveBeenCalled();
});

it("reports an upstream failure without discarding successfully saved settings", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path === "/api/v1/operator/provider/status")
        return new Response(JSON.stringify(status));
      if (path === "/api/v1/operator/provider" && init?.method === "PUT")
        return new Response(
          JSON.stringify({ ...configuration, revision: "2" }),
        );
      if (path === "/api/v1/operator/provider/sync")
        return new Response(
          JSON.stringify({
            error: {
              code: "UPSTREAM_STATUS",
              message: "Provider returned HTTP 403",
              requestId: "test",
            },
          }),
          { status: 503 },
        );
      return new Response(JSON.stringify(configuration));
    }),
  );
  render(<ProviderSettings />);
  const save = await screen.findByRole("button", {
    name: "Сохранить и загрузить страницу",
  });
  await waitFor(() => expect(save.hasAttribute("disabled")).toBe(false));
  fireEvent.click(save);
  expect(await screen.findByText("Конфигурация сохранена.")).toBeTruthy();
  expect(
    await screen.findByText(/Настройки сохранены, но загрузка не выполнена/),
  ).toBeTruthy();
});

it("does not allow manual syncing when the source is disabled", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (path: string) =>
        new Response(
          JSON.stringify(
            path.endsWith("/status")
              ? { ...status, sourceConfigured: false }
              : configuration,
          ),
        ),
    ),
  );
  render(<ProviderSettings />);
  const button = await screen.findByRole("button", {
    name: "Загрузить одну страницу",
  });
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(true));
});

it("requires an identity and a meaningful note for polygon verification, not for fetching", async () => {
  const observationId = "11111111-2222-4333-8444-555555555555";
  let reviewed = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      if (path === "/api/v1/operator/provider/status")
        return new Response(
          JSON.stringify({
            ...status,
            pendingReview: 1,
            pendingWithGeometry: 1,
          }),
        );
      if (path === "/api/v1/operator/notices")
        return new Response(
          JSON.stringify({
            notices: reviewed
              ? []
              : [
                  {
                    id: observationId,
                    sourceUrl: configuration.endpoint,
                    retrievedAt: "2026-11-01T12:00:00.000Z",
                    contractorName: "Fixture",
                    cadastralNumber: null,
                    geometryAvailable: true,
                    startAt: null,
                    endAt: null,
                    treatments: [],
                  },
                ],
          }),
        );
      if (path === `/api/v1/operator/notices/${observationId}/review`) {
        expect(init?.headers).not.toHaveProperty("Authorization");
        expect(JSON.parse(String(init?.body))).toEqual({
          decision: "verified",
          reviewer: "Reviewer",
          evidenceNote: "Checked the polygon against the original.",
        });
        reviewed = true;
        return new Response(JSON.stringify({ status: "verified" }));
      }
      return new Response(JSON.stringify(configuration));
    }),
  );
  render(<ProviderSettings />);
  const pendingButton = await screen.findByRole("button", {
    name: "Показать ожидающие проверки записи",
  });
  await waitFor(() =>
    expect(pendingButton.hasAttribute("disabled")).toBe(false),
  );
  fireEvent.click(pendingButton);
  const confirm = await screen.findByRole("button", {
    name: "Подтвердить и опубликовать",
  });
  expect(confirm.hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByLabelText("Имя проверяющего"), {
    target: { value: "Reviewer" },
  });
  fireEvent.change(screen.getByLabelText("Основание проверки записи"), {
    target: { value: "Checked the polygon against the original." },
  });
  expect(confirm.hasAttribute("disabled")).toBe(false);
  fireEvent.click(confirm);
  await waitFor(() => expect(reviewed).toBe(true));
});
