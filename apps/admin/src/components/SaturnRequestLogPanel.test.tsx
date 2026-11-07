// Feature IDs: SOURCES.DOCUMENT_HISTORY
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SaturnRequestLogPanel } from "./SaturnRequestLogPanel";

const { load } = vi.hoisted(() => ({
  load: vi.fn(async () => ({
    entries: [
      {
        id: "1",
        action: "viewport_page",
        initiator: "web",
        districtId: 1477,
        pageNumber: 0,
        requestHash: "a".repeat(64),
        status: "succeeded",
        receivedCount: 10,
        errorCode: null,
        startedAt: "2026-11-07T12:00:00.000Z",
        finishedAt: "2026-11-07T12:00:01.000Z",
      },
      {
        id: "2",
        action: "district_directory",
        initiator: "admin",
        districtId: null,
        pageNumber: null,
        requestHash: null,
        status: "throttled",
        receivedCount: 0,
        errorCode: "SOURCE_THROTTLED",
        startedAt: "2026-11-07T12:01:00.000Z",
        finishedAt: "2026-11-07T12:01:00.000Z",
      },
    ],
  })),
}));
vi.mock("../api/client", () => ({ loadSaturnRequestLog: load }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("shows persisted browser and operator attempts, including failed cooldowns", async () => {
  render(<SaturnRequestLogPanel locale="ru" />);
  expect(await screen.findByText(/Индекс полей, район/)).toBeTruthy();
  expect(screen.getByText(/SOURCE_THROTTLED/)).toBeTruthy();
  expect(screen.getByText(/лимит частоты/)).toBeTruthy();
  expect(screen.getByText(/\/backend\/beemaster\/query/)).toBeTruthy();
  expect(screen.getByText(/\/backend\/beemaster\/district\/55/)).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Обновить журнал запросов" }),
  );
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
});
