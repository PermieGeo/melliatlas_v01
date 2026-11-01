// Feature IDs: SOURCES.PROVIDER_CONFIGURATION
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProviderSettings } from "./ProviderSettings";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const config = {
  providerName: "Test provider", endpoint: "https://example.org/plans",
  request: { method: "POST", regionParameter: "subject", regionCode: 55, parameters: {} },
  revision: "1", accessDecision: "pending", collectionEnabled: false,
};

it("requires an operator token and submits edited parameters to the backend", async () => {
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      const edited = JSON.parse(String(init.body));
      expect(edited.request.regionCode).toBe(67);
      expect(edited.providerName).toBe("Test provider");
      expect(edited.request.regionContainer).toBe("beekeperSearchFilter");
      expect(init.headers).toMatchObject({ Authorization: "Bearer test-operator" });
      return new Response(JSON.stringify({ ...config, ...edited, revision: "2" }), { status: 200 });
    }
    return new Response(JSON.stringify(config), { status: 200 });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<ProviderSettings />);
  expect(screen.queryByLabelText("Адрес API источника")).toBeNull();
  fireEvent.change(screen.getByLabelText("Токен оператора"), { target: { value: "test-operator" } });
  fireEvent.click(screen.getByRole("button", { name: "Открыть настройки" }));
  expect(await screen.findByLabelText("Адрес API источника")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Код региона"), { target: { value: "67" } });
  fireEvent.change(screen.getByLabelText("Объект фильтра региона"), { target: { value: "beekeperSearchFilter" } });
  fireEvent.click(screen.getByRole("button", { name: "Сохранить конфигурацию" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(await screen.findByText(/Автоматическая загрузка отключена/)).toBeTruthy();
});

it("does not expose settings after credentials are changed", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(config), { status: 200 })));
  render(<ProviderSettings />);
  fireEvent.change(screen.getByLabelText("Токен оператора"), { target: { value: "old-token" } });
  fireEvent.click(screen.getByRole("button", { name: "Открыть настройки" }));
  expect(await screen.findByLabelText("Адрес API источника")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Токен оператора"), { target: { value: "new-token" } });
  expect(screen.queryByLabelText("Адрес API источника")).toBeNull();
});

it("discards an in-flight settings response after the operator token changes", async () => {
  let respond: ((value: Response) => void) | undefined;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { respond = resolve; })));
  render(<ProviderSettings />);
  fireEvent.change(screen.getByLabelText("Токен оператора"), { target: { value: "old-token" } });
  fireEvent.click(screen.getByRole("button", { name: "Открыть настройки" }));
  fireEvent.change(screen.getByLabelText("Токен оператора"), { target: { value: "new-token" } });
  respond?.(new Response(JSON.stringify(config), { status: 200 }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Открыть настройки" }).hasAttribute("disabled")).toBe(false));
  expect(screen.queryByLabelText("Адрес API источника")).toBeNull();
});
