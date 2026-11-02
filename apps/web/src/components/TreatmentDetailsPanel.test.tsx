import { expect, it } from "vitest";
import { cadastralEntries } from "./TreatmentDetailsPanel";

it("lists separate source cadastral numbers without inventing missing entries", () => {
  expect(
    cadastralEntries(
      " 67:01:0000001:100; 67:01:0000001:101\n67:01:0000001:100 ",
    ),
  ).toEqual(["67:01:0000001:100", "67:01:0000001:101"]);
  expect(cadastralEntries(null)).toEqual([]);
  expect(cadastralEntries("  ")).toEqual([]);
});
