import type { OllamaStatus } from "@localchat/shared";
import { Badge } from "../ui/Primitives";

export function PrivacyPanel({ status }: { status: OllamaStatus | null }) {
  return (
    <div className="space-y-4 text-sm leading-6 text-secondary">
      <section className="rounded-xl border border-border-subtle bg-elevated p-4">
        <h3 className="mb-2 text-base font-medium text-primary">Local-only by design</h3>
        <p>
          LocalChat runs entirely on this computer. Chat inference, embeddings,
          document storage, and conversation history never leave{" "}
          <code className="rounded bg-muted px-1 py-0.5">127.0.0.1</code>.
        </p>
      </section>

      <section className="rounded-xl border border-border-subtle bg-elevated p-4">
        <h3 className="mb-3 text-base font-medium text-primary">Current status</h3>
        <ul className="space-y-2">
          <li className="flex items-center justify-between gap-3">
            <span>Ollama service</span>
            <Badge tone={status?.online ? "success" : "danger"}>
              {status?.online ? "Online" : "Offline"}
            </Badge>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>Chat model</span>
            <Badge tone={status?.selectedModelAvailable ? "success" : "warning"}>
              {status?.selectedModelAvailable ? "Ready" : "Missing"}
            </Badge>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>Embedding model</span>
            <Badge tone={status?.embeddingModelAvailable ? "success" : "warning"}>
              {status?.embeddingModelAvailable ? "Ready" : "Missing"}
            </Badge>
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-border-subtle bg-elevated p-4">
        <h3 className="mb-2 text-base font-medium text-primary">Untrusted content</h3>
        <p>
          Model output and imported documents are treated as untrusted. Markdown is
          sanitized before rendering and raw HTML or scripts are never executed.
        </p>
      </section>
    </div>
  );
}
