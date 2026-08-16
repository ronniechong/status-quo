import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import TrendChart from "./TrendChart";

function days(counts: number[]) {
	return counts.map((count, i) => ({ date: `2026-08-${String(i + 1).padStart(2, "0")}`, count }));
}

describe("TrendChart", () => {
	it("renders one bar per day of data", () => {
		const { container } = render(<TrendChart data={days([0, 1, 2, 3])} selectedWindowDays={2} locale="en-US" />);
		// 1 bar per data point + 1 shaded-window overlay rect
		const rects = container.querySelectorAll("rect");
		expect(rects.length).toBe(5);
	});

	it("renders an accessible aria-label describing the chart", () => {
		const { getByRole } = render(<TrendChart data={days([0, 1])} selectedWindowDays={1} locale="en-US" />);
		expect(getByRole("img", { name: /incidents per day, last 2 days/i })).toBeTruthy();
	});

	it("handles an all-zero dataset without throwing", () => {
		expect(() => render(<TrendChart data={days([0, 0, 0])} selectedWindowDays={1} locale="en-US" />)).not.toThrow();
	});
});
