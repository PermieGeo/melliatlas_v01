import type { MapTreatment } from "@melliatlas/contracts";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MapAnalysisPanel } from "./MapAnalysisPanel";

const sample: MapTreatment = {
  id: "00000000-0000-4000-8000-000000000099",
  sourceName: "Fixture provider",
  sourceUrl: "https://example.org/plan",
  retrievedAt: "2026-11-03T08:00:00.000Z",
  publishedAt: null,
  startAt: null,
  endAt: null,
  contractorName: null,
  cadastralNumber: null,
  treatments: [],
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [32, 54.7],
        [32.1, 54.7],
        [32, 54.8],
        [32, 54.7],
      ],
    ],
  },
  spatialPrecision: "exact_polygon",
  reviewStatus: "verified",
};

afterEach(() => cleanup());

it("counts only previewed records by review state without treating them as spray events", () => {
  const notices: MapTreatment[] = [
    sample,
    {
      ...sample,
      id: "00000000-0000-4000-8000-000000000098",
      reviewStatus: "pending",
    },
    {
      ...sample,
      id: "00000000-0000-4000-8000-000000000097",
      reviewStatus: undefined,
    },
  ];
  render(<MapAnalysisPanel locale="ru" notices={notices} />);
  const summary = within(
    screen.getByRole("region", { name: "Краткая статистика" }),
  );
  expect(
    summary.getByText("Записей на карте").nextElementSibling?.textContent,
  ).toBe("3");
  expect(
    summary.getByText("Проверены оператором").nextElementSibling?.textContent,
  ).toBe("1");
  expect(
    summary.getByText("Без подтверждённой проверки").nextElementSibling
      ?.textContent,
  ).toBe("2");
  expect(summary.getByText(/не статистика выполненных обработок/)).toBeTruthy();
});

it("explains empty and localized preview states without inventing historical data", () => {
  const { rerender } = render(<MapAnalysisPanel locale="ru" notices={[]} />);
  expect(
    screen.getByText(/Отсутствие данных не означает отсутствия обработок/),
  ).toBeTruthy();
  rerender(<MapAnalysisPanel locale="en" notices={[sample]} />);
  expect(screen.getByRole("region", { name: "Quick summary" })).toBeTruthy();
  expect(
    screen.getByText(
      /Historical comparisons, trends and forecasts will follow/,
    ),
  ).toBeTruthy();
});
