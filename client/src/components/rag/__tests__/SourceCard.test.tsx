import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceCard } from "../../rag/SourceCard";
import { ThemeProvider } from "../../../theme/ThemeProvider";

describe("SourceCard", () => {
  it("renders document metadata and excerpt", () => {
    render(
      <ThemeProvider>
        <SourceCard
          citation={{
            id: "c1",
            messageId: "m1",
            chunkId: "ch1",
            documentId: "d1",
            originalName: "policy.pdf",
            pageNumber: 4,
            chunkIndex: 12,
            content: "Refunds are available within 30 days.",
            similarity: 0.82,
          }}
          onSelect={vi.fn()}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText("policy.pdf")).toBeTruthy();
    expect(screen.getByText(/similarity 0.82/)).toBeTruthy();
    expect(screen.getByText(/Refunds are available within 30 days/)).toBeTruthy();
  });
});
