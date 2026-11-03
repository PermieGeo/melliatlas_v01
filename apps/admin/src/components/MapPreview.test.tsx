import type { MapTreatment } from "@melliatlas/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { MapPreview } from "./MapPreview";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: PropsWithChildren) => <div>{children}</div>,
  TileLayer: () => null,
  Polygon: ({ eventHandlers }: { eventHandlers: { click(): void } }) => (
    <button type="button" onClick={eventHandlers.click}>
      Select sample polygon
    </button>
  ),
}));

const notice: MapTreatment = {
  id: "00000000-0000-4000-8000-000000000091",
  sourceName: "DEMO — SYNTHETIC DATA (NOT SATURN)",
  sourceUrl: "https://sample.invalid/treatment",
  retrievedAt: "2026-11-03T08:00:00.000Z",
  publishedAt: null,
  startAt: "2026-11-05T08:00:00.000Z",
  endAt: null,
  contractorName: "Example cooperative",
  cadastralNumber: "DEMO-PARCEL-A; DEMO-PARCEL-B",
  treatments: [
    { name: "Example product", crop: "Example crop", beeHazardClass: 2 },
  ],
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [32, 54.7],
        [32.1, 54.7],
        [32.1, 54.8],
        [32, 54.7],
      ],
    ],
  },
  spatialPrecision: "exact_polygon",
  reviewStatus: "pending",
};

afterEach(() => cleanup());

it("shows full selected field evidence beside the map and supports closing", () => {
  render(<MapPreview locale="ru" notices={[notice]} />);
  const panel = screen.getByRole("complementary", {
    name: "Информация об участке",
  });
  expect(panel.textContent).toContain("Выберите участок");
  fireEvent.click(
    screen.getByRole("button", { name: "Select sample polygon" }),
  );
  expect(panel.textContent).toContain("Example cooperative");
  expect(panel.textContent).toContain("Example product");
  expect(panel.textContent).toContain("DEMO-PARCEL-B");
  expect(
    panel.querySelectorAll('[data-testid="admin-cadastral-list"] li'),
  ).toHaveLength(2);
  expect(
    screen.getByRole("link", { name: "Первоисточник" }).getAttribute("href"),
  ).toBe(notice.sourceUrl);
  expect(panel.textContent).toContain("Не проверено оператором");
  fireEvent.click(
    screen.getByRole("button", { name: "Закрыть сведения об участке" }),
  );
  expect(panel.textContent).toContain("Выберите участок");
});

it("clears the detail view when the selected field disappears after refresh", () => {
  const { rerender } = render(<MapPreview locale="en" notices={[notice]} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Select sample polygon" }),
  );
  const panel = screen.getByRole("complementary", { name: "Field details" });
  expect(panel.textContent).toContain("Example cooperative");
  rerender(<MapPreview locale="en" notices={[]} />);
  expect(panel.textContent).toContain("Select a field");
  expect(panel.textContent).not.toContain("Example cooperative");
});
