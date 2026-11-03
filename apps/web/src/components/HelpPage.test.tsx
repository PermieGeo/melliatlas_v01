import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HelpPage } from "./HelpPage";

const fixture = {
  version: 1,
  locale: "ru",
  title: "External guide",
  intro: "Local guidance",
  sections: [
    {
      id: "map",
      title: "Map workflow",
      paragraphs: ["Open the map"],
      steps: ["Select a field"],
    },
  ],
  example: {
    id: "demo",
    title: "Fictional example",
    paragraphs: ["Only demo data"],
  },
  warningsTitle: "Caution",
  warnings: ["Not real evidence"],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("retries a failed static help request without fetching source records", async () => {
  let attempts = 0;
  const fetcher = vi.fn(async (url: string) => {
    if (url !== "/help/ru.json") throw new Error("Unexpected help path");
    attempts += 1;
    return attempts === 1
      ? new Response(null, { status: 503 })
      : new Response(JSON.stringify(fixture));
  });
  vi.stubGlobal("fetch", fetcher);
  render(<HelpPage locale="ru" onShowMap={() => {}} />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
  expect(
    await screen.findByRole("heading", { name: "External guide" }),
  ).toBeTruthy();
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.every(([url]) => url === "/help/ru.json")).toBe(
    true,
  );
});

it("does not render a wrong-language or invalid help document", async () => {
  const fetcher = vi.fn(
    async () => new Response(JSON.stringify({ ...fixture, locale: "en" })),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<HelpPage locale="ru" onShowMap={() => {}} />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText("External guide")).toBeNull();
});
