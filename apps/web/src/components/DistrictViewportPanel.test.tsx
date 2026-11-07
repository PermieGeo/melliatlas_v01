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
import type { ViewportCollectionResult } from "@melliatlas/contracts";

const { status, next, directory, refreshDirectory, points } = vi.hoisted(
  () => ({
    directory: vi.fn(async () => ({
      enabled: true,
      retrievedAt: null,
      districts: [],
    })),
    refreshDirectory: vi.fn(async () => ({
      enabled: true,
      retrievedAt: "2026-11-07T00:00:00.000Z",
      districts: [
        {
          id: 1477,
          name: "Ярцевский район",
          latitude: 55.06,
          longitude: 32.68,
        },
        { id: 2670, name: "Город Смоленск", latitude: 54.78, longitude: 32.05 },
      ],
    })),
    points: vi.fn(async () => ({
      totalKnown: 1,
      centers: [
        { featureId: "55", planId: "60", centerX: 32.6, centerY: 55.1 },
      ],
    })),
    status: vi.fn(
      async (_selection: unknown): Promise<ViewportCollectionResult> => ({
        enabled: true,
        progress: null,
      }),
    ),
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
      cachedCenters: [
        { featureId: "55", planId: "60", centerX: 32.6, centerY: 55.1 },
      ],
    })),
  }),
);
vi.mock("../api/client", () => ({
  loadDistrictViewportProgress: status,
  fetchDistrictViewportPage: next,
  loadSaturnDistrictCatalog: directory,
  refreshSaturnDistrictCatalog: refreshDirectory,
  loadSavedDistrictPoints: points,
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
      onCachedCentersChange={() => {}}
    />,
  );
  expect(screen.getByText(/^1\.\s+.*справочник районов/)).toBeTruthy();
  expect(next).not.toHaveBeenCalled();
  fireEvent.change(
    screen.getByRole("combobox", { name: "Район Смоленской области" }),
    { target: { value: "1477" } },
  );
  expect(onFocusDistrict).toHaveBeenCalledWith({ lat: 55.06, lon: 32.68 });
  rerender(
    <DistrictViewportPanel
      locale="ru"
      viewport={[32.42, 54.94, 33.02, 55.2]}
      onFocusDistrict={onFocusDistrict}
      onCachedCentersChange={() => {}}
    />,
  );
  expect(next).not.toHaveBeenCalled();
});

it("loads only one page on explicit click and reports separate index progress", async () => {
  const onCenters = vi.fn();
  render(
    <DistrictViewportPanel
      locale="ru"
      viewport={bbox}
      onFocusDistrict={() => {}}
      onCachedCentersChange={onCenters}
    />,
  );
  fireEvent.change(
    screen.getByRole("combobox", { name: "Район Смоленской области" }),
    { target: { value: "1477" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Проверить кэш" }));
  expect(
    await screen.findByText(
      "Для выбранного квадрата пока нет сохранённых страниц.",
    ),
  ).toBeTruthy();
  expect(next).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Получить ещё до 10 записей" }),
  );
  await waitFor(() => expect(next).toHaveBeenCalledTimes(1));
  expect(await screen.findByText(/Страниц: 1 \/ 3/)).toBeTruthy();
  expect(onCenters).toHaveBeenCalledWith([
    { featureId: "55", planId: "60", centerX: 32.6, centerY: 55.1 },
  ]);
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
      onCachedCentersChange={() => {}}
    />,
  );
  fireEvent.change(
    screen.getByRole("combobox", { name: "Smolensk Oblast district" }),
    { target: { value: "1477" } },
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Fetch up to 10 more records",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(next).not.toHaveBeenCalled();
});

it("explains the 124-day limit and offers a bounded range instead of silently disabling collection", () => {
  render(
    <DistrictViewportPanel
      locale="ru"
      viewport={bbox}
      onFocusDistrict={() => {}}
      onCachedCentersChange={() => {}}
    />,
  );
  fireEvent.change(
    screen.getByRole("combobox", { name: "Район Смоленской области" }),
    { target: { value: "1477" } },
  );
  fireEvent.change(screen.getByLabelText("Обновления карты с"), {
    target: { value: "2026-01-01" },
  });
  expect(screen.getByText(/интервал не более 124 дней/)).toBeTruthy();
  expect(
    (
      screen.getByRole("button", {
        name: "Получить ещё до 10 записей",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(
    screen.getByRole("button", { name: "Оставить последние 124 дня периода" }),
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Получить ещё до 10 записей",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  expect(next).not.toHaveBeenCalled();
});

it("inspects the exact cached viewport after selection without triggering provider traffic", async () => {
  status.mockResolvedValueOnce({
    enabled: true,
    progress: {
      requestHash: "a".repeat(64),
      state: "partial",
      nextPage: 1,
      pagesFetched: 1,
      entriesReceived: 10,
      totalPages: 3,
      totalElements: 22,
      completedAt: null,
      sourceRevisionCurrent: true,
    },
    cachedCenters: [
      { featureId: "55", planId: "60", centerX: 32.6, centerY: 55.1 },
    ],
  });
  const onCenters = vi.fn();
  render(
    <DistrictViewportPanel
      locale="ru"
      viewport={bbox}
      onFocusDistrict={() => {}}
      onCachedCentersChange={onCenters}
    />,
  );
  fireEvent.change(
    screen.getByRole("combobox", { name: "Район Смоленской области" }),
    { target: { value: "1477" } },
  );
  await waitFor(() => expect(status).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(onCenters).toHaveBeenCalledWith([
      { featureId: "55", planId: "60", centerX: 32.6, centerY: 55.1 },
    ]),
  );
  expect(next).not.toHaveBeenCalled();
});

it("loads the provider district directory explicitly and supports selection of another provider ID", async () => {
  const focus = vi.fn();
  render(
    <DistrictViewportPanel
      locale="ru"
      viewport={bbox}
      onFocusDistrict={focus}
      onCachedCentersChange={() => {}}
    />,
  );
  expect(refreshDirectory).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Получить все районы из Сатурна" }),
  );
  await waitFor(() => expect(refreshDirectory).toHaveBeenCalledTimes(1));
  await screen.findByRole("option", { name: "Город Смоленск" });
  fireEvent.change(
    screen.getByRole("combobox", { name: "Район Смоленской области" }),
    { target: { value: "2670" } },
  );
  expect(focus).toHaveBeenCalledWith({ lat: 54.78, lon: 32.05 });
  expect(next).not.toHaveBeenCalled();
});
