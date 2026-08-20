import { Button, Badge, EmptyState, Skeleton } from "../components/ui/Primitives";
import { SourceCard } from "../components/rag/SourceCard";
import { MessageBubble } from "../components/MessageList";
import { useTheme } from "../theme/ThemeProvider";

export function DesignSystemPage({ onBack }: { onBack: () => void }) {
  const { mode, setMode } = useTheme();

  return (
    <div className="min-h-screen bg-base px-6 py-8 text-primary">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">LocalChat Design System</h1>
            <p className="mt-2 text-secondary">
              Semantic tokens, core components, and message states for the offline workspace.
            </p>
          </div>
          <Button onClick={onBack}>Back to workspace</Button>
        </header>

        <section className="panel-surface p-6">
          <h2 className="mb-4 text-xl font-medium">Theme</h2>
          <div className="flex flex-wrap gap-2">
            {(["dark", "light", "system"] as const).map((option) => (
              <Button
                key={option}
                variant={mode === option ? "primary" : "secondary"}
                onClick={() => setMode(option)}
              >
                {option}
              </Button>
            ))}
          </div>
        </section>

        <section className="panel-surface p-6">
          <h2 className="mb-4 text-xl font-medium">Colors & badges</h2>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">Neutral</Badge>
            <Badge tone="accent">Accent</Badge>
            <Badge tone="success">Success</Badge>
            <Badge tone="warning">Warning</Badge>
            <Badge tone="danger">Danger</Badge>
            <Badge tone="info">Info</Badge>
          </div>
        </section>

        <section className="panel-surface space-y-4 p-6">
          <h2 className="text-xl font-medium">Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </div>
        </section>

        <section className="panel-surface space-y-4 p-6">
          <h2 className="text-xl font-medium">Message states</h2>
          <MessageBubble
            message={{
              id: "1",
              conversationId: "c1",
              role: "user",
              content: "Explain the refund policy from my local docs.",
              createdAt: Date.now(),
            }}
            actions={{
              onCopy: () => undefined,
            }}
          />
          <MessageBubble
            message={{
              id: "2",
              conversationId: "c1",
              role: "assistant",
              content:
                "The policy allows refunds within 30 days.\n\n```ts\nconst windowDays = 30;\n```",
              createdAt: Date.now(),
              citations: [
                {
                  id: "c1",
                  messageId: "2",
                  chunkId: "ch1",
                  documentId: "d1",
                  originalName: "policy.pdf",
                  pageNumber: 4,
                  chunkIndex: 12,
                  content: "Refunds are available within 30 days of purchase.",
                  similarity: 0.82,
                },
              ],
            }}
            actions={{
              onCopy: () => undefined,
              onRegenerate: () => undefined,
            }}
          />
          <MessageBubble
            message={{
              id: "3",
              conversationId: "c1",
              role: "system",
              content: "System notice example",
              createdAt: Date.now(),
            }}
            errorText="Example offline error state when Ollama is unavailable."
          />
        </section>

        <section className="panel-surface space-y-4 p-6">
          <h2 className="text-xl font-medium">Source card</h2>
          <SourceCard
            citation={{
              id: "c1",
              messageId: "m1",
              chunkId: "ch1",
              documentId: "d1",
              originalName: "policy.pdf",
              pageNumber: 4,
              chunkIndex: 12,
              content: "Refunds are available within 30 days of purchase.",
              similarity: 0.82,
            }}
            onSelect={() => undefined}
          />
        </section>

        <section className="panel-surface space-y-4 p-6">
          <h2 className="text-xl font-medium">Skeleton & empty states</h2>
          <Skeleton className="h-12 w-full" />
          <EmptyState
            title="No conversations yet"
            description="Start a new chat to populate your local workspace history."
            action={<Button>New Chat</Button>}
          />
        </section>
      </div>
    </div>
  );
}
