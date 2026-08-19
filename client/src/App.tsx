import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Conversation,
  ConversationWithMessages,
  OllamaStatus,
} from "@localchat/shared";
import {
  clearConversationMessages,
  createConversation,
  deleteConversation,
  downloadExport,
  fetchModels,
  getConversation,
  listConversations,
  streamMessage,
  streamRegenerate,
  updateConversation,
} from "./api/client";
import { ChatComposer } from "./components/ChatComposer";
import { ConversationSidebar } from "./components/ConversationSidebar";
import { MessageList } from "./components/MessageList";
import { StatusIndicator } from "./components/StatusIndicator";
import { useOllamaStatus } from "./hooks/useOllamaStatus";

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<ConversationWithMessages | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [systemPromptDraft, setSystemPromptDraft] = useState("");
  const [models, setModels] = useState<OllamaStatus["models"]>([]);
  const [defaultModel, setDefaultModel] = useState("qwen2.5:7b");
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const selectedModel = activeConversation?.model ?? defaultModel;
  const { status, loading: statusLoading, refresh } = useOllamaStatus(
    selectedModel,
  );

  const loadConversations = useCallback(async () => {
    const items = await listConversations();
    setConversations(items);
    return items;
  }, []);

  const loadModels = useCallback(async () => {
    try {
      const result = await fetchModels();
      setModels(result.models);
      setDefaultModel(result.defaultModel);
    } catch (loadError) {
      setModels([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load models",
      );
    }
  }, []);

  const selectConversation = useCallback(async (id: string) => {
    setLoadingConversation(true);
    setError(null);
    try {
      const conversation = await getConversation(id);
      setActiveId(id);
      setActiveConversation(conversation);
      setSystemPromptDraft(conversation.systemPrompt);
    } catch (selectError) {
      setError(
        selectError instanceof Error
          ? selectError.message
          : "Failed to load conversation",
      );
    } finally {
      setLoadingConversation(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const items = await loadConversations();
        await loadModels();
        if (items[0]) {
          await selectConversation(items[0].id);
        }
      } catch (initError) {
        setError(
          initError instanceof Error
            ? initError.message
            : "Failed to initialize LocalChat",
        );
      }
    })();
  }, [loadConversations, loadModels, selectConversation]);

  const modelOptions = useMemo(() => {
    const names = new Set(models.map((model) => model.name));
    if (selectedModel && !names.has(selectedModel)) {
      names.add(selectedModel);
    }
    return Array.from(names).sort();
  }, [models, selectedModel]);

  const refreshActiveConversation = useCallback(async () => {
    if (!activeId) {
      return;
    }
    const conversation = await getConversation(activeId);
    setActiveConversation(conversation);
    setConversations(await listConversations());
  }, [activeId]);

  const handleCreateConversation = async () => {
    setError(null);
    const created = await createConversation({
      title: "New conversation",
      model: defaultModel,
    });
    await loadConversations();
    await selectConversation(created.id);
  };

  const handleRenameConversation = async (id: string, title: string) => {
    await updateConversation(id, { title });
    await loadConversations();
    if (activeId === id && activeConversation) {
      setActiveConversation({ ...activeConversation, title });
    }
  };

  const handleDeleteConversation = async (id: string) => {
    await deleteConversation(id);
    const items = await loadConversations();
    if (activeId === id) {
      if (items[0]) {
        await selectConversation(items[0].id);
      } else {
        setActiveId(null);
        setActiveConversation(null);
      }
    }
  };

  const handleModelChange = async (model: string) => {
    if (!activeId || !activeConversation) {
      return;
    }
    const updated = await updateConversation(activeId, { model });
    setActiveConversation({ ...activeConversation, model: updated.model });
    await loadConversations();
    void refresh();
  };

  const handleSystemPromptBlur = async () => {
    if (!activeId || !activeConversation) {
      return;
    }
    if (systemPromptDraft === activeConversation.systemPrompt) {
      return;
    }
    const updated = await updateConversation(activeId, {
      systemPrompt: systemPromptDraft,
    });
    setActiveConversation({
      ...activeConversation,
      systemPrompt: updated.systemPrompt,
    });
  };

  const handleStreamEvents = async (
    runner: (
      onEvent: (event: import("@localchat/shared").ChatStreamEvent) => void,
      signal: AbortSignal,
    ) => Promise<void>,
  ) => {
    if (!activeId) {
      return;
    }

    setError(null);
    setIsStreaming(true);
    setStreamingContent("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await runner((event) => {
        if (event.type === "token") {
          setStreamingContent((current) => current + event.content);
        }
        if (event.type === "error") {
          setError(event.message);
        }
      }, controller.signal);

      await refreshActiveConversation();
    } catch (streamError) {
      if (!(streamError instanceof DOMException && streamError.name === "AbortError")) {
        setError(
          streamError instanceof Error
            ? streamError.message
            : "Streaming failed",
        );
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      abortRef.current = null;
    }
  };

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || !activeId || isStreaming) {
      return;
    }

    setDraft("");
    await handleStreamEvents((onEvent, signal) =>
      streamMessage(activeId, content, onEvent, signal),
    );
  };

  const handleRegenerate = async () => {
    if (!activeId || isStreaming) {
      return;
    }

    await handleStreamEvents((onEvent, signal) =>
      streamRegenerate(activeId, onEvent, signal, selectedModel),
    );
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleClearChat = async () => {
    if (!activeId) {
      return;
    }
    if (!window.confirm("Clear all messages in this conversation?")) {
      return;
    }
    await clearConversationMessages(activeId);
    await refreshActiveConversation();
  };

  const chatDisabled =
    !status?.online ||
    !status.selectedModelAvailable ||
    loadingConversation ||
    !activeConversation;

  return (
    <div className="flex h-screen bg-surface text-gray-100">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => void selectConversation(id)}
        onCreate={() => void handleCreateConversation()}
        onRename={(id, title) => void handleRenameConversation(id, title)}
        onDelete={(id) => void handleDeleteConversation(id)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">
              {activeConversation?.title ?? "Select a conversation"}
            </h2>
            <StatusIndicator status={status} loading={statusLoading} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-gray-400" htmlFor="model-select">
              Model
            </label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={(event) => void handleModelChange(event.target.value)}
              disabled={!activeConversation}
              className="rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm"
            >
              {modelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={!activeConversation || isStreaming}
              onClick={() => void handleRegenerate()}
              className="rounded-lg border border-surface-border px-3 py-2 text-sm hover:bg-surface-raised disabled:opacity-50"
            >
              Regenerate
            </button>
            <button
              type="button"
              disabled={!activeConversation}
              onClick={handleClearChat}
              className="rounded-lg border border-surface-border px-3 py-2 text-sm hover:bg-surface-raised disabled:opacity-50"
            >
              Clear chat
            </button>
            <button
              type="button"
              disabled={!activeConversation}
              onClick={() => activeId && downloadExport(activeId, "markdown")}
              className="rounded-lg border border-surface-border px-3 py-2 text-sm hover:bg-surface-raised disabled:opacity-50"
            >
              Export MD
            </button>
            <button
              type="button"
              disabled={!activeConversation}
              onClick={() => activeId && downloadExport(activeId, "json")}
              className="rounded-lg border border-surface-border px-3 py-2 text-sm hover:bg-surface-raised disabled:opacity-50"
            >
              Export JSON
            </button>
          </div>
        </header>

        {error && (
          <div className="border-b border-red-900 bg-red-950/40 px-5 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {!status?.online && (
          <div className="border-b border-amber-900 bg-amber-950/30 px-5 py-3 text-sm text-amber-100">
            Ollama is unavailable at http://127.0.0.1:11434. Start Ollama, pull a
            model, then refresh.
          </div>
        )}

        {status?.online && !status.selectedModelAvailable && (
          <div className="border-b border-amber-900 bg-amber-950/30 px-5 py-3 text-sm text-amber-100">
            Model "{selectedModel}" is not installed. Run:{" "}
            <code className="rounded bg-black/40 px-1">
              ollama pull {selectedModel}
            </code>
          </div>
        )}

        <section className="border-b border-surface-border px-5 py-4">
          <label
            htmlFor="system-prompt"
            className="mb-2 block text-sm font-medium text-gray-300"
          >
            System prompt
          </label>
          <textarea
            id="system-prompt"
            value={systemPromptDraft}
            onChange={(event) => setSystemPromptDraft(event.target.value)}
            onBlur={() => void handleSystemPromptBlur()}
            disabled={!activeConversation}
            rows={3}
            placeholder="Optional instructions for this conversation"
            className="w-full rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
          />
        </section>

        <section className="flex-1 overflow-y-auto px-5 py-4">
          {loadingConversation ? (
            <div className="text-gray-400">Loading conversation…</div>
          ) : (
            <MessageList
              messages={activeConversation?.messages ?? []}
              streamingContent={streamingContent}
              isStreaming={isStreaming}
            />
          )}
        </section>

        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSubmit={() => void handleSend()}
          onStop={handleStop}
          isStreaming={isStreaming}
          disabled={chatDisabled}
          placeholder={
            chatDisabled
              ? "Connect Ollama and select an available model to chat"
              : "Message LocalChat (Enter to send, Shift+Enter for newline)"
          }
        />
      </main>
    </div>
  );
}
