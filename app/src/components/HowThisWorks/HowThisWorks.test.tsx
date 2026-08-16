import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HowThisWorksLink from "./HowThisWorksLink";

describe("HowThisWorksLink", () => {
	it("opens the modal and sets a permalink hash when clicked, closes and clears it on close", async () => {
		window.history.pushState(null, "", "/status-quo/");
		render(<HowThisWorksLink defaultModel="openai/gpt-oss-120b" defaultPromptVersion="v3" />);

		fireEvent.click(screen.getByRole("link", { name: "How this works" }));
		expect(window.location.hash).toBe("#/how-this-works");
		await waitFor(() => expect(screen.getByText(/0% combined/)).toBeTruthy());
		expect(screen.getByText(/not an independent party/)).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: /close/i }));
		await waitFor(() => expect(window.location.hash).toBe(""));
	});

	it("opens directly when the page loads with the how-this-works hash", async () => {
		window.history.pushState(null, "", "/status-quo/#/how-this-works");
		render(<HowThisWorksLink defaultModel="openai/gpt-oss-120b" defaultPromptVersion="v3" />);
		await waitFor(() => expect(screen.getByText(/0% combined/)).toBeTruthy());
	});
});
