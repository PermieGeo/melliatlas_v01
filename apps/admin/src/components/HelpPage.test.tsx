import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HelpPage } from "./HelpPage";

const fixture = {
  version: 1,
  locale: "ru",
  title: "External operator guide",
  intro: "Local workflow",
  sections: [
    {
      id: "review",
      title: "Operator review",
      paragraphs: ["Inspect original evidence"],
      steps: ["Select an observation"],
    },
  ],
  example: { id: "demo", title: "Sample", paragraphs: ["Synthetic only"] },
  warningsTitle: "Security",
  warnings: ["Local only"],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("retries the local guide after a malformed document without provider calls", async () => {
  let attempts = 0;
  const fetcher = vi.fn(async (url: string) => {
    if (url !== "/help/ru.json") throw new Error("Unexpected help path");
    attempts += 1;
    return new Response(
      JSON.stringify(attempts === 1 ? { invalid: true } : fixture),
    );
  });
  vi.stubGlobal("fetch", fetcher);
  render(<HelpPage locale="ru" onShowImport={() => {}} />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
  expect(
    await screen.findByRole("heading", { name: "External operator guide" }),
  ).toBeTruthy();
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.every(([url]) => url === "/help/ru.json")).toBe(
    true,
  );
});
