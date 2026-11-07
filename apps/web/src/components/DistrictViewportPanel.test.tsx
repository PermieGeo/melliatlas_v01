// Feature IDs: SOURCES.DOCUMENT_HISTORY
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DistrictViewportPanel } from "./DistrictViewportPanel";

const { status, next } = vi.hoisted(() => ({
  status: vi.fn(async (_selection: unknown) => ({
    enabled: true,
    progress: null,
  })),
  next: vi.fn(async (_selection: unknown) => ({
    enabled: true,
    progress: {
      requestHash: "a".repeat(64),
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
  loadDistrictViewportProgress: status,
  fetchDistrictViewportPage: next,
}));
const bbox = [32.41, 54.93, 33.03, 55.21] as const;
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("shows setup guidance and never collects on render, selecting a district or moving a map", () => {
  const onFocusDistrict = vi.fn();
  const { rerender } = render(
    <DistrictViewportPanel
      locale="ru"
      viewport={bbox}
      onFocusDistrict={onFocusDistrict}
    />,
  );
  expect(screen.getByText(/1\. Выберите район/)).toBeTruthy();
  expect(next).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("combobox", { name: "Район (пилот)" }), {
    target: { value: "1477" },
  });
  expect(onFocusDistrict).toHaveBeenCalledWith({ lat: 55.06, lon: 32.68 });
  rerender(
    <DistrictViewportPanel
      locale="ru"
      viewport={[32.42, 54.94, 33.02, 55.2]}
      onFocusDistrict={onFocusDistrict}
    />,
  );
  expect(next).not.toHaveBeenCalled();
});

it("loads only one page on explicit click and reports separate index progress", async () => {
  render(
    <DistrictViewportPanel
      locale="ru"
      viewport={bbox}
      onFocusDistrict={() => {}}
    />,
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Район (пилот)" }), {
    target: { value: "1477" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Проверить кэш" }));
  expect(
    await screen.findByText(
      "Для выбранного квадрата пока нет сохранённых страниц.",
    ),
  ).toBeTruthy();
  expect(next).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Загрузить страницу" }));
  await waitFor(() => expect(next).toHaveBeenCalledTimes(1));
  expect(await screen.findByText(/Страниц: 1 \/ 3/)).toBeTruthy();
  expect(next.mock.calls[0]?.[0]).toMatchObject({
    districtId: 1477,
    bbox: {
      west: bbox[0],
      south: bbox[1],
      east: bbox[2],
      north: bbox[3],
    },
  });
});

it("blocks oversized viewports and invalid dates before sending a request", () => {
  render(
    <DistrictViewportPanel
      locale="en"
      viewport={[30, 53, 35, 55]}
      onFocusDistrict={() => {}}
    />,
  );
  fireEvent.change(screen.getByRole("combobox", { name: "District (pilot)" }), {
    target: { value: "1477" },
  });
  expect(
    (screen.getByRole("button", { name: "Load page" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(next).not.toHaveBeenCalled();
});
