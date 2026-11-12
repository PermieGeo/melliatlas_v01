// Feature IDs: MAP.POINT_SELECTION, NOTICES.MAP_OVERLAY
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TerritorySelector } from "./TerritorySelector";

const { regions, districts } = vi.hoisted(() => ({
  regions: vi.fn(async () => ({
    regions: [
      { id: "55", name: "Test region" },
      { id: "77", name: "Other region" },
    ],
  })),
  districts: vi.fn(async (id: string) => ({
    regionId: id,
    districts: [
      { id: "1477", name: `${id} district`, center: { lat: 55, lon: 32 } },
    ],
  })),
}));
vi.mock("../api/client", () => ({
  loadTerritoryRegions: regions,
  loadTerritoryDistricts: districts,
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  regions.mockResolvedValue({
    regions: [
      { id: "55", name: "Test region" },
      { id: "77", name: "Other region" },
    ],
  });
  districts.mockImplementation(async (id: string) => ({
    regionId: id,
    districts: [
      { id: "1477", name: `${id} district`, center: { lat: 55, lon: 32 } },
    ],
  }));
});

it("navigates using read-only territory lists without invoking ingestion", async () => {
  const focus = vi.fn();
  render(<TerritorySelector locale="ru" onFocus={focus} />);
  await screen.findByRole("option", { name: "Test region" });
  fireEvent.change(screen.getByRole("combobox", { name: "Регион" }), {
    target: { value: "55" },
  });
  await screen.findByRole("option", { name: "55 district" });
  fireEvent.change(screen.getByRole("combobox", { name: "Район" }), {
    target: { value: "1477" },
  });
  expect(focus).toHaveBeenCalledWith({ lat: 55, lon: 32 });
  fireEvent.change(screen.getByRole("combobox", { name: "Регион" }), {
    target: { value: "77" },
  });
  await screen.findByRole("option", { name: "77 district" });
  expect(
    (screen.getByRole("combobox", { name: "Район" }) as HTMLSelectElement)
      .value,
  ).toBe("");
  expect(regions).toHaveBeenCalledTimes(1);
  expect(districts).toHaveBeenCalledTimes(2);
});

it("shows a setup message when database has no registered regions", async () => {
  regions.mockResolvedValueOnce({ regions: [] });
  render(<TerritorySelector locale="ru" onFocus={() => {}} />);
  expect(await screen.findByText(/Список регионов пока пуст/)).toBeTruthy();
  expect(districts).not.toHaveBeenCalled();
});

it("distinguishes read failures from an empty catalog", async () => {
  regions.mockRejectedValueOnce(new Error("offline"));
  render(<TerritorySelector locale="ru" onFocus={() => {}} />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.queryByText(/Список регионов пока пуст/)).toBeNull();
});

it("ignores an obsolete district response after switching regions", async () => {
  let resolveOld:
    | ((value: {
        regionId: string;
        districts: Array<{
          id: string;
          name: string;
          center: { lat: number; lon: number };
        }>;
      }) => void)
    | undefined;
  districts.mockImplementationOnce(
    () =>
      new Promise<{
        regionId: string;
        districts: Array<{
          id: string;
          name: string;
          center: { lat: number; lon: number };
        }>;
      }>((resolve) => {
        resolveOld = resolve;
      }),
  );
  render(<TerritorySelector locale="en" onFocus={() => {}} />);
  await screen.findByRole("option", { name: "Test region" });
  fireEvent.change(screen.getByRole("combobox", { name: "Region" }), {
    target: { value: "55" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Region" }), {
    target: { value: "77" },
  });
  await screen.findByRole("option", { name: "77 district" });
  await act(async () =>
    resolveOld?.({
      regionId: "55",
      districts: [
        { id: "1", name: "Old district", center: { lat: 1, lon: 1 } },
      ],
    }),
  );
  expect(screen.queryByRole("option", { name: "Old district" })).toBeNull();
  await waitFor(() => expect(districts).toHaveBeenCalledTimes(2));
});
