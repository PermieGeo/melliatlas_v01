import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { FieldHelp } from "./FieldHelp";

afterEach(cleanup);

it("closes help on an outside click but not on an inside click", () => {
  render(
    <>
      <button type="button">Outside control</button>
      <button type="button" disabled>
        Disabled control
      </button>
      <FieldHelp locale="ru" subject="regionCode" message="helpRegionCode" />
    </>,
  );
  const trigger = screen.getByRole("button", {
    name: "Справка: Код региона поставщика",
  });
  const details = trigger.closest("details") as HTMLDetailsElement;
  fireEvent.click(trigger);
  expect(details.open).toBe(true);
  fireEvent.click(screen.getByRole("note"));
  expect(details.open).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Outside control" }));
  expect(details.open).toBe(false);
  fireEvent.click(trigger);
  expect(details.open).toBe(true);
  fireEvent.pointerDown(
    screen.getByRole("button", { name: "Disabled control" }),
  );
  expect(details.open).toBe(false);
  fireEvent.click(trigger);
  expect(details.open).toBe(true);
  fireEvent.click(trigger);
  expect(details.open).toBe(false);
});

it("closes help with Escape and restores focus to its trigger", () => {
  render(
    <FieldHelp locale="en" subject="regionCode" message="helpRegionCode" />,
  );
  const trigger = screen.getByRole("button", {
    name: "Help: Provider region code",
  });
  const details = trigger.closest("details") as HTMLDetailsElement;
  fireEvent.click(trigger);
  fireEvent.keyDown(document, { key: "ArrowDown" });
  expect(details.open).toBe(true);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(details.open).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

it("dismisses an earlier help when another help opens", () => {
  render(
    <>
      <FieldHelp locale="ru" subject="regionCode" message="helpRegionCode" />
      <FieldHelp locale="ru" subject="endpoint" message="helpEndpoint" />
    </>,
  );
  const first = screen.getByRole("button", {
    name: "Справка: Код региона поставщика",
  });
  const second = screen.getByRole("button", {
    name: "Справка: HTTPS API endpoint",
  });
  fireEvent.click(first);
  expect((first.closest("details") as HTMLDetailsElement).open).toBe(true);
  fireEvent.click(second);
  expect((first.closest("details") as HTMLDetailsElement).open).toBe(false);
  expect((second.closest("details") as HTMLDetailsElement).open).toBe(true);
});
