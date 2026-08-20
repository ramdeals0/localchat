import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge, Button, EmptyState } from "../Primitives";
import { ThemeProvider } from "../../../theme/ThemeProvider";

function renderWithTheme(ui: React.ReactNode) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe("UI primitives", () => {
  it("renders button snapshot", () => {
    const { container } = renderWithTheme(<Button variant="primary">Send</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("renders badge with text", () => {
    renderWithTheme(<Badge tone="accent">qwen2.5:7b</Badge>);
    expect(screen.getByText("qwen2.5:7b")).toBeTruthy();
  });

  it("renders empty state", () => {
    renderWithTheme(
      <EmptyState
        title="No conversations yet"
        description="Start a new chat."
      />,
    );
    expect(screen.getByText("No conversations yet")).toBeTruthy();
  });
});
