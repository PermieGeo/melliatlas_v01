import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./components/MapCanvas", () => ({
  MapCanvas: () => <div aria-label="Map fixture">Map fixture</div>,
}));

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
  expect(screen.getByLabelText("Map fixture")).toBeTruthy();
  expect(await screen.findByText("Карта и обзор территории")).toBeTruthy();
});
