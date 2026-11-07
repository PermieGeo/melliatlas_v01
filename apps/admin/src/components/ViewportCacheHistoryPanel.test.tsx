// Feature IDs: SOURCES.DOCUMENT_HISTORY
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ViewportCacheHistoryPanel } from "./ViewportCacheHistoryPanel";

const { read } = vi.hoisted(() => ({
  read: vi.fn(async () => ({
    entries: [
      {
        requestHash: "b".repeat(64),
        sourceRevision: "1",
        sourceRevisionCurrent: true,
        districtId: 1477,
        bbox: { west: 32.4, south: 54.9, east: 33.0, north: 55.2 },
        fromDate: "2026-08-01",
        toDate: "2026-11-30",
        state: "partial" as const,
        pagesFetched: 1,
        entriesReceived: 10,
        totalPages: 3,
        updatedAt: "2026-11-07T12:00:00.000Z",
        recentPages: [
          {
            pageNumber: 0,
            recordCount: 10,
            storedAt: "2026-11-07T12:00:00.000Z",
          },
        ],
      },
    ],
  })),
}));

vi.mock("../api/client", () => ({ loadViewportCacheHistory: read }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("shows persisted client and operator index history and page receipts without collecting", async () => {
  render(<ViewportCacheHistoryPanel locale="ru" />);

  const counts = await screen.findByText(
    (_, element) =>
      element?.tagName === "P" &&
      /Записей индекса в БД\s*:\s*10\b/.test(element.textContent ?? "") &&
      /Получено порций \(до 10 записей\)\s*:\s*1\s*\/\s*3\b/.test(
        element.textContent ?? "",
      ),
  );
  expect(counts).toBeTruthy();

  fireEvent.click(
    screen.getByText("Показать точные границы и последние сохранения"),
  );
  expect(
    screen.getByText(
      (_, element) =>
        element?.tagName === "LI" &&
        /Порция\s*:\s*1\b/.test(element.textContent ?? "") &&
        /Записей индекса в БД\s*:\s*10\b/.test(element.textContent ?? ""),
    ),
  ).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Обновить журнал" }));
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
});
