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
  loadOperatorSaturnRegions: vi.fn(async () => ({
    regions: [{ code: "55", name: "Smolensk" }],
  })),
  loadOperatorSaturnDistricts: vi.fn(async () => ({
    regionCode: "55",
    enabled: false,
    retrievedAt: null,
    districts: [
      { id: 1477, name: "Yartsevo", latitude: 55.06, longitude: 32.68 },
    ],
  })),
}));

async function selectViewport(): Promise<void> {
  await screen.findByRole("option", { name: "Smolensk" });
  fireEvent.change(screen.getByLabelText("Регион источника"), {
    target: { value: "55" },
  });
  await screen.findByRole("option", { name: "Yartsevo" });
  fireEvent.change(screen.getByLabelText("Район источника"), {
    target: { value: "1477" },
  });
  for (const [label, value] of [
    ["Запад (долгота)", "32.41"],
    ["Юг (широта)", "54.93"],
    ["Восток (долгота)", "33.03"],
    ["Север (широта)", "55.21"],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

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
  await selectViewport();
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
