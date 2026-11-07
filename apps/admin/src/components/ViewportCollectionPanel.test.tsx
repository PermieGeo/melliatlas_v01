// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ViewportCollectionPanel } from "./ViewportCollectionPanel";

const { check, fetchNext } = vi.hoisted(() => ({
  check: vi.fn(async () => ({ enabled: true, progress: null })),
  fetchNext: vi.fn(async () => ({
    enabled: true,
    progress: {
      requestHash: "b".repeat(64),
      state: "partial" as const,
      nextPage: 1,
      pagesFetched: 1,
      entriesReceived: 10,
      totalPages: 3,
      totalElements: 22,
      completedAt: null,
      sourceRevisionCurrent: true,
    },
  })),
}));
vi.mock("../api/client", () => ({
  loadViewportProgress: check,
  fetchViewportNextPage: fetchNext,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("never starts external retrieval during render or viewport edits", () => {
  render(<ViewportCollectionPanel locale="ru" />);
  expect(fetchNext).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Запад (долгота)"), {
    target: { value: "32.5" },
  });
  expect(check).not.toHaveBeenCalled();
  expect(fetchNext).not.toHaveBeenCalled();
});

it("distinguishes read-only progress from one requested upstream page", async () => {
  render(<ViewportCollectionPanel locale="ru" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Проверить сохранённое" }),
  );
  expect(
    await screen.findByText("Для этого квадрата ещё не загружено страниц."),
  ).toBeTruthy();
  expect(check).toHaveBeenCalledTimes(1);
  expect(fetchNext).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Получить ещё до 10 записей" }),
  );
  expect(await screen.findByText(/Страниц: 1 \/ 3/)).toBeTruthy();
  expect(fetchNext).toHaveBeenCalledTimes(1);
});

it.each([
  { locale: "ru" as const, label: "Точные координаты и даты квадрата" },
  { locale: "en" as const, label: "Exact viewport bounds and date range" },
])(
  "uses a dedicated disclosure name for technical viewport inputs in $locale",
  ({ locale, label }) => {
    render(<ViewportCollectionPanel locale={locale} />);
    expect(screen.getByText(label)).toBeTruthy();
  },
);
