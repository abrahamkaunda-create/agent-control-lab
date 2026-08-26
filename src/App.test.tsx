import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

describe("Agent Control Lab", () => {
  it("provides a route back to the portfolio homepage", () => {
    render(<App />);

    expect(screen.getByRole("link", { name: /Portfolio home/ })).toHaveAttribute(
      "href",
      "https://abrahamkaunda-create.github.io/#top",
    );
    expect(screen.getByRole("group", { name: "Synthetic scenarios" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Account recovery/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("routes a sensitive action through human approval", async () => {
    const createObjectURL = vi.fn(() => "blob:audit-export");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const downloadClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Evaluate proposal" }));

    expect(await screen.findByRole("button", { name: "Approve once" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Approve once" }));

    await waitFor(() => expect(screen.getByText("Expected state confirmed")).toBeInTheDocument());
    expect(screen.getByText("Human approval recorded")).toBeInTheDocument();
    expect(screen.getByText("Approved once")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(downloadClick).toHaveBeenCalledOnce();
    downloadClick.mockRestore();
  });

  it("blocks the prompt-injection export proposal", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Injection-style document/ }));
    fireEvent.click(screen.getByRole("button", { name: "Evaluate proposal" }));

    await waitFor(() => expect(screen.getAllByText(/ACL-DENY-005/).length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByText("Execution blocked")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Approve once" })).not.toBeInTheDocument();
  });

  it("shows visibly different decisions when the role changes", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Privilege-escalation attempt/ }));
    fireEvent.change(screen.getByLabelText("Evaluate as role"), { target: { value: "platform-administrator" } });
    fireEvent.click(screen.getByRole("button", { name: "Evaluate proposal" }));

    expect(await screen.findByRole("button", { name: "Approve once" })).toBeInTheDocument();
    expect(screen.getAllByText(/ACL-REVIEW-003/).length).toBeGreaterThan(0);
  });
});
