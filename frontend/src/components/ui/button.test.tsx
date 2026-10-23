import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Button } from "./button";
afterEach(cleanup);
test("disabled actions cannot fire and link composition preserves navigation", () => {
  const click = vi.fn();
  render(
    <>
      <Button disabled onClick={click}>
        Save approval
      </Button>
      <Button asChild variant="outline">
        <a href="/opportunities">Explore opportunities</a>
      </Button>
    </>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Save approval" }));
  expect(click).not.toHaveBeenCalled();
  expect(
    screen.getByRole("link", { name: "Explore opportunities" }),
  ).toHaveAttribute("href", "/opportunities");
});
