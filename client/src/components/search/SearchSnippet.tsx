import type { SearchSnippetPart } from "@localchat/shared";

interface SearchSnippetProps {
  parts: SearchSnippetPart[];
  className?: string;
}

export function SearchSnippet({ parts, className = "" }: SearchSnippetProps) {
  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.match ? (
          <mark
            key={`${index}-${part.text}`}
            className="rounded bg-accent/20 px-0.5 text-primary"
          >
            {part.text}
          </mark>
        ) : (
          <span key={`${index}-${part.text}`}>{part.text}</span>
        ),
      )}
    </span>
  );
}
