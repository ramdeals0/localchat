import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Conversation,
  ConversationWithMessages,
  DocumentRecord,
  DocumentScope,
  Message,
  MessageCitation,
  OllamaStatus,
  SearchHit,
} from "@localchat/shared";
import {
  branchConversation,
  clearConversationMessages,
  createConversation,
  deleteConversation,
  downloadExport,
  fetchModels,
  getConversation,
  listConversations,
  listDocuments,
  saveMessageAsPrompt,
  streamMessage,
  streamRegenerate,
  truncateConversationFromMessage,
  updateConversation,
} from "../api/client";
import { BackupPanel } from "../components/BackupPanel";
import { ChatComposer } from "../components/ChatComposer";
import { PromptComposerModal } from "../components/PromptComposerModal";
import { PromptLibraryPage } from "../components/PromptLibraryPage";
import {
  ConversationSidebar,
  type WorkspaceView,
} from "../components/ConversationSidebar";
import { KnowledgeBasePage } from "../components/KnowledgeBasePage";
import { MessageList } from "../components/MessageList";
import { SearchPage } from "../components/search/SearchPage";
import { PrivacyPanel } from "../components/privacy/PrivacyPanel";
import { ContextPanel } from "../components/rag/SourceCard";
import { AppShell } from "../components/shell/AppShell";
import { ChatHeader } from "../components/shell/ChatHeader";
import { CommandPalette, type CommandItem } from "../components/ui/CommandPalette";
import { EmptyState, Button } from "../components/ui/Primitives";
import { useToast } from "../components/ui/ToastProvider";
import { useKeyboardShortcuts, useMediaQuery } from "../hooks/useWorkspace";
import { useOllamaStatus } from "../hooks/useOllamaStatus";
import { useTheme } from "../theme/ThemeProvider";

type ContextMode = "sources" | "privacy" | "settings" | "backup";

export function ChatWorkspace({ onOpenDesignSystem }: { onOpenDesignSystem: () => void }) {
  const { pushToast } = useToast();
  const { setMode, mode } = useTheme();
  const isMobile = useMediaQuery("(max-width: 1024px)");
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const [activeView, setActiveView] = useState<WorkspaceView>("chat");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<ConversationWithMessages | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [systemPromptDraft, setSystemPromptDraft] = useState("");
  const [models, setModels] = useState<OllamaStatus["models"]>([]);
  const [defaultModel, setDefaultModel] = useState("qwen2.5:7b");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [useDocuments, setUseDocuments] = useState(false);
  const [documentScope, setDocumentScope] = useState<DocumentScope>("all");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingCitations, setStreamingCitations] = useState<MessageCitation[]>([]);
  const [noRelevantSources, setNoRelevantSources] = useState(false);
  const [lastUserQuery, setLastUserQuery] = useState("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [contextMode, setContextMode] = useState<ContextMode>("privacy");
  const [activeCitation, setActiveCitation] = useState<MessageCitation | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [promptComposerOpen, setPromptComposerOpen] = useState(false);
  const [scrollToMessageId, setScrollToMessageId] = useState<string | null>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [openPromptId, setOpenPromptId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const selectedModel = activeConversation?.model ?? defaultModel;
  const { status, loading: statusLoading, refresh } = useOllamaStatus(selectedModel);

  const readyDocuments = useMemo(
    () => documents.filter((document) => document.status === "ready"),
    [documents],
  );

  const ragOptions = useMemo(
    () => ({
      useDocuments,
      documentScope,
      documentIds: documentScope === "selected" ? selectedDocumentIds : undefined,
    }),
    [useDocuments, documentScope, selectedDocumentIds],
  );

  const panelCitations = useMemo(() => {
    const fromMessages =
      activeConversation?.messages
        .flatMap((message) => message.citations ?? [])
        .filter(Boolean) ?? [];
    return streamingCitations.length > 0 ? streamingCitations : fromMessages;
  }, [activeConversation?.messages, streamingCitations]);

  const loadConversations = useCallback(async () => {
    const items = await listConversations();
    setConversations(items);
    return items;
  }, []);

  const loadDocumentsList = useCallback(async () => {
    const items = await listDocuments();
    setDocuments(items);
    return items;
  }, []);

  const loadModels = useCallback(async () => {
    const result = await fetchModels();
    setModels(result.models);
    setDefaultModel(result.defaultModel);
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
        selectError instanceof Error ? selectError.message : "Failed to load conversation",
      );
    } finally {
      setLoadingConversation(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setLoadingConversations(true);
        const items = await loadConversations();
        await loadModels();
        await loadDocumentsList();
        if (items[0]) {
          await selectConversation(items[0].id);
        }
      } catch (initError) {
        setError(
          initError instanceof Error ? initError.message : "Failed to initialize LocalChat",
        );
      } finally {
        setLoadingConversations(false);
      }
    })();
  }, [loadConversations, loadDocumentsList, loadModels, selectConversation]);

  const modelOptions = useMemo(() => {
    const names = new Set(models.map((model) => model.name));
    if (selectedModel && !names.has(selectedModel)) {
      names.add(selectedModel);
    }
    return Array.from(names).sort();
  }, [models, selectedModel]);

  const refreshActiveConversation = useCallback(async () => {
    if (!activeId) return;
    const conversation = await getConversation(activeId);
    setActiveConversation(conversation);
    setConversations(await listConversations());
  }, [activeId]);

  const handleCreateConversation = async () => {
    const created = await createConversation({ title: "New conversation", model: defaultModel });
    await loadConversations();
    setActiveView("chat");
    await selectConversation(created.id);
    pushToast({ tone: "success", title: "New chat created" });
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
      if (items[0]) await selectConversation(items[0].id);
      else {
        setActiveId(null);
        setActiveConversation(null);
      }
    }
  };

  const handleModelChange = async (model: string) => {
    if (!activeId || !activeConversation) return;
    const updated = await updateConversation(activeId, { model });
    setActiveConversation({ ...activeConversation, model: updated.model });
    await loadConversations();
    void refresh();
  };

  const handleSystemPromptBlur = async () => {
    if (!activeId || !activeConversation) return;
    if (systemPromptDraft === activeConversation.systemPrompt) return;
    const updated = await updateConversation(activeId, { systemPrompt: systemPromptDraft });
    setActiveConversation({ ...activeConversation, systemPrompt: updated.systemPrompt });
  };

  const handleStreamEvents = async (
    userQuery: string,
    runner: (
      onEvent: (event: import("@localchat/shared").ChatStreamEvent) => void,
      signal: AbortSignal,
    ) => Promise<void>,
  ) => {
    if (!activeId) return;

    setError(null);
    setIsStreaming(true);
    setStreamingContent("");
    setStreamingCitations([]);
    setNoRelevantSources(false);
    setLastUserQuery(userQuery);
    setContextMode("sources");
    setRightOpen(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await runner((event) => {
        if (event.type === "token") {
          setStreamingContent((current) => current + event.content);
        }
        if (event.type === "sources") {
          setStreamingCitations(event.citations);
          setNoRelevantSources(event.noRelevantSources);
        }
        if (event.type === "error") {
          setError(event.message);
          pushToast({ tone: "error", title: "Generation failed", description: event.message });
        }
      }, controller.signal);
      await refreshActiveConversation();
    } catch (streamError) {
      if (!(streamError instanceof DOMException && streamError.name === "AbortError")) {
        const message = streamError instanceof Error ? streamError.message : "Streaming failed";
        setError(message);
        pushToast({ tone: "error", title: "Streaming failed", description: message });
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      setStreamingCitations([]);
      setNoRelevantSources(false);
      abortRef.current = null;
    }
  };

  const handleSend = async (contentOverride?: string) => {
    const content = (contentOverride ?? draft).trim();
    if (!content || !activeId || isStreaming) return;
    setDraft("");
    await handleStreamEvents(content, (onEvent, signal) =>
      streamMessage(activeId, content, onEvent, signal, ragOptions),
    );
  };

  const handleRegenerate = async () => {
    if (!activeId || isStreaming) return;
    const lastUser = [...(activeConversation?.messages ?? [])]
      .reverse()
      .find((message) => message.role === "user");
    await handleStreamEvents(lastUser?.content ?? "", (onEvent, signal) =>
      streamRegenerate(activeId, onEvent, signal, selectedModel, ragOptions),
    );
  };

  const handleClearChat = async () => {
    if (!activeId) return;
    if (!window.confirm("Clear all messages in this conversation?")) return;
    await clearConversationMessages(activeId);
    await refreshActiveConversation();
    pushToast({ tone: "info", title: "Conversation cleared" });
  };

  const handleCopyMessage = async (message: Message) => {
    await navigator.clipboard.writeText(message.content);
    pushToast({ tone: "success", title: "Message copied" });
  };

  const handleEditResend = async (message: Message) => {
    if (!activeId) return;
    const next = window.prompt("Edit message", message.content);
    if (!next?.trim()) return;
    await truncateConversationFromMessage(activeId, message.id);
    await refreshActiveConversation();
    await handleSend(next.trim());
  };

  const handleBranch = async (message: Message) => {
    if (!activeId) return;
    const branched = await branchConversation(activeId, message.id);
    await loadConversations();
    await selectConversation(branched.id);
    pushToast({ tone: "success", title: "Conversation branched" });
  };

  const handleExportMessage = async (message: Message) => {
    await navigator.clipboard.writeText(`## ${message.role}\n\n${message.content}`);
    pushToast({ tone: "success", title: "Message markdown copied" });
  };

  const handleSaveMessageAsPrompt = async (message: Message) => {
    if (!activeId) return;
    try {
      const prompt = await saveMessageAsPrompt({
        messageId: message.id,
        conversationId: activeId,
      });
      pushToast({ tone: "success", title: "Saved as prompt", description: prompt.title });
    } catch (saveError) {
      pushToast({
        tone: "error",
        title: "Failed to save prompt",
        description: saveError instanceof Error ? saveError.message : undefined,
      });
    }
  };

  const handleLaunchFromPrompt = async (payload: {
    conversationId: string;
    ragEnabled: boolean;
    defaultTemperature: number | null;
  }) => {
    setActiveView("chat");
    if (payload.ragEnabled) {
      setUseDocuments(true);
    }
    await loadConversations();
    const conversation = await getConversation(payload.conversationId);
    setActiveId(payload.conversationId);
    setActiveConversation(conversation);
    setSystemPromptDraft(conversation.systemPrompt);

    const lastUser = [...conversation.messages]
      .reverse()
      .find((message) => message.role === "user");
    const hasAssistant = conversation.messages.some((message) => message.role === "assistant");

    if (lastUser && !hasAssistant && !isStreaming) {
      const launchRagOptions = {
        useDocuments: payload.ragEnabled,
        documentScope,
        documentIds: documentScope === "selected" ? selectedDocumentIds : undefined,
      };
      await handleStreamEvents(lastUser.content, (onEvent, signal) =>
        streamMessage(payload.conversationId, lastUser.content, onEvent, signal, launchRagOptions),
      );
    }

    pushToast({ tone: "success", title: "Chat created from template" });
  };

  const handleSearchNavigate = async (hit: SearchHit) => {
    if (hit.entityType === "prompt") {
      setOpenPromptId(hit.entityId);
      setActiveView("prompts");
      return;
    }
    if (hit.conversationId) {
      setActiveView("chat");
      await selectConversation(hit.conversationId);
      if (hit.entityType === "message") {
        setScrollToMessageId(hit.entityId);
        setHighlightMessageId(hit.entityId);
        window.setTimeout(() => {
          setScrollToMessageId(null);
          setHighlightMessageId(null);
        }, 2500);
      }
    }
  };

  const handleSlashCommand = (command: string) => {
    switch (command) {
      case "/clear":
        void handleClearChat();
        break;
      case "/export":
        if (activeId) downloadExport(activeId, "markdown");
        break;
      case "/docs":
        setActiveView("knowledge");
        break;
      case "/prompt":
        setPromptComposerOpen(true);
        break;
      case "/regenerate":
        void handleRegenerate();
        break;
      case "/help":
        pushToast({
          tone: "info",
          title: "Slash commands",
          description: "/clear /export /docs /prompt /regenerate /help",
        });
        break;
      default:
        break;
    }
  };

  const focusComposer = () => {
    composerRef.current?.focus();
  };

  const commandItems: CommandItem[] = [
    { id: "new", label: "New chat", group: "Chat", hint: "Ctrl+N", action: () => void handleCreateConversation() },
    { id: "focus", label: "Focus composer", group: "Chat", hint: "Ctrl+/", action: focusComposer },
    { id: "prompt", label: "Open Prompt Library", group: "Navigation", action: () => setActiveView("prompts") },
    { id: "docs", label: "Open Knowledge Base", group: "Navigation", action: () => setActiveView("knowledge") },
    { id: "search", label: "Open Search", group: "Navigation", hint: "Ctrl+Shift+F", action: () => setActiveView("search") },
    {
      id: "export",
      label: "Export conversation",
      group: "Chat",
      action: () => {
        if (activeId) downloadExport(activeId, "markdown");
      },
    },
    {
      id: "settings",
      label: "Open settings",
      group: "Navigation",
      action: () => {
        setContextMode("settings");
        setRightOpen(true);
      },
    },
    { id: "sidebar", label: "Toggle sidebar", group: "View", hint: "Ctrl+B", action: () => setLeftOpen((v) => !v) },
    { id: "privacy", label: "Open privacy panel", group: "Navigation", action: () => { setContextMode("privacy"); setRightOpen(true); } },
    { id: "backup", label: "Open backup & import", group: "Navigation", action: () => { setContextMode("backup"); setRightOpen(true); } },
    { id: "design", label: "Open design system", group: "Navigation", action: onOpenDesignSystem },
    { id: "theme-dark", label: "Use dark theme", group: "Theme", action: () => setMode("dark") },
    { id: "theme-light", label: "Use light theme", group: "Theme", action: () => setMode("light") },
    { id: "theme-system", label: "Use system theme", group: "Theme", action: () => setMode("system") },
  ];

  useKeyboardShortcuts([
    { key: "k", ctrlOrMeta: true, handler: () => setCommandOpen(true) },
    { key: "f", ctrlOrMeta: true, shift: true, handler: () => setActiveView("search") },
    { key: "n", ctrlOrMeta: true, handler: () => void handleCreateConversation() },
    { key: "/", ctrlOrMeta: true, handler: focusComposer },
    { key: "b", ctrlOrMeta: true, handler: () => setLeftOpen((value) => !value) },
  ]);

  const chatDisabled =
    !status?.online ||
    !status.selectedModelAvailable ||
    loadingConversation ||
    !activeConversation ||
    (useDocuments && !status.embeddingModelAvailable);

  const settingsPanel = (
    <div className="space-y-4 text-sm">
      <div>
        <label className="mb-2 block text-secondary" htmlFor="settings-system-prompt">
          System prompt
        </label>
        <textarea
          id="settings-system-prompt"
          value={systemPromptDraft}
          onChange={(event) => setSystemPromptDraft(event.target.value)}
          onBlur={() => void handleSystemPromptBlur()}
          rows={5}
          className="w-full rounded-xl border border-border-subtle bg-muted px-3 py-2 text-primary"
        />
      </div>
      <label className="flex items-center gap-2 text-primary">
        <input
          type="checkbox"
          checked={useDocuments}
          onChange={(event) => setUseDocuments(event.target.checked)}
        />
        Use documents
      </label>
      {useDocuments ? (
        <>
          <label className="block text-secondary" htmlFor="settings-doc-scope">
            Source scope
          </label>
          <select
            id="settings-doc-scope"
            value={documentScope}
            onChange={(event) => setDocumentScope(event.target.value as DocumentScope)}
            className="w-full rounded-lg border border-border-subtle bg-muted px-3 py-2"
          >
            <option value="all">All ready documents</option>
            <option value="selected">Selected documents only</option>
          </select>
          {documentScope === "selected" ? (
            <div className="space-y-2">
              {readyDocuments.map((document) => (
                <label key={document.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedDocumentIds.includes(document.id)}
                    onChange={() =>
                      setSelectedDocumentIds((current) =>
                        current.includes(document.id)
                          ? current.filter((id) => id !== document.id)
                          : [...current, document.id],
                      )
                    }
                  />
                  {document.originalName}
                </label>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      <p className="text-secondary">Theme: {mode}</p>
    </div>
  );

  const sidebar = (
    <ConversationSidebar
      conversations={conversations}
      activeId={activeId}
      activeView={activeView}
      loading={loadingConversations}
      onViewChange={setActiveView}
      onSelect={(id) => void selectConversation(id)}
      onCreate={() => void handleCreateConversation()}
      onRename={(id, title) => void handleRenameConversation(id, title)}
      onDelete={(id) => void handleDeleteConversation(id)}
    />
  );

  const contextPanel = (
    <ContextPanel
      mode={contextMode}
      citations={panelCitations}
      activeCitation={activeCitation}
      query={lastUserQuery}
      noRelevantSources={noRelevantSources}
      onSelectCitation={(citation) => {
        setActiveCitation(citation);
        setContextMode("sources");
      }}
      privacyPanel={<PrivacyPanel status={status} />}
      settingsPanel={settingsPanel}
      backupPanel={
        <BackupPanel
          selectedConversationIds={activeId ? [activeId] : []}
          onImported={() => {
            void loadConversations();
            void loadDocumentsList();
            if (activeId) void refreshActiveConversation();
          }}
        />
      }
    />
  );

  return (
    <>
      <AppShell
        leftSidebar={sidebar}
        rightPanel={activeView === "chat" ? contextPanel : undefined}
        leftOpen={leftOpen}
        rightOpen={rightOpen && activeView === "chat"}
        onToggleLeft={() => setLeftOpen((value) => !value)}
        onToggleRight={() => setRightOpen((value) => !value)}
        onCloseDrawers={() => {
          if (isMobile) {
            setLeftOpen(false);
            setRightOpen(false);
          }
        }}
        isMobile={isMobile}
      >
        {activeView === "knowledge" ? (
          <KnowledgeBasePage />
        ) : activeView === "prompts" ? (
          <PromptLibraryPage
            openPromptId={openPromptId}
            onOpenPromptHandled={() => setOpenPromptId(null)}
            onLaunchConversation={(payload) => void handleLaunchFromPrompt(payload)}
          />
        ) : activeView === "search" ? (
          <SearchPage
            models={modelOptions}
            onNavigate={(hit) => void handleSearchNavigate(hit)}
          />
        ) : (
          <>
            <ChatHeader
              title={activeConversation?.title ?? "New conversation"}
              model={selectedModel}
              modelOptions={modelOptions}
              status={status}
              statusLoading={statusLoading}
              useDocuments={useDocuments}
              requireEmbedding={useDocuments}
              leftOpen={leftOpen}
              rightOpen={rightOpen}
              onModelChange={(model) => void handleModelChange(model)}
              onToggleDocuments={() => setUseDocuments((value) => !value)}
              onToggleLeft={() => setLeftOpen((value) => !value)}
              onToggleRight={() => setRightOpen((value) => !value)}
              onOpenSettings={() => {
                setContextMode("settings");
                setRightOpen(true);
              }}
              onRegenerate={() => void handleRegenerate()}
              onClear={() => void handleClearChat()}
              onExportMarkdown={() => activeId && downloadExport(activeId, "markdown")}
              onExportJson={() => activeId && downloadExport(activeId, "json")}
              canAct={Boolean(activeConversation)}
              isStreaming={isStreaming}
            />

            {error ? (
              <div className="border-b border-danger/30 bg-danger/10 px-5 py-3 text-sm text-danger">
                {error}
              </div>
            ) : null}

            {!status?.online ? (
              <div className="border-b border-warning/30 bg-warning/10 px-5 py-3 text-sm text-warning">
                Ollama is unavailable at http://127.0.0.1:11434. Start Ollama and pull your models.
              </div>
            ) : null}

            <section className="relative min-h-0 flex-1 px-4 py-4 lg:px-6">
              {!activeConversation && !loadingConversation ? (
                <EmptyState
                  title="Welcome to LocalChat"
                  description="A calm, premium offline workspace for local models and document-grounded conversations."
                  action={<Button onClick={() => void handleCreateConversation()}>Start a new chat</Button>}
                />
              ) : (
                <MessageList
                  messages={activeConversation?.messages ?? []}
                  streamingContent={streamingContent}
                  isStreaming={isStreaming}
                  streamingCitations={streamingCitations}
                  noRelevantSources={noRelevantSources}
                  lastUserQuery={lastUserQuery}
                  loading={loadingConversation}
                  onCitationClick={(citation) => {
                    setActiveCitation(citation);
                    setContextMode("sources");
                    setRightOpen(true);
                  }}
                  actions={{
                    onCopy: (message) => void handleCopyMessage(message),
                    onEditResend: (message) => void handleEditResend(message),
                    onRegenerate: () => void handleRegenerate(),
                    onBranch: (message) => void handleBranch(message),
                    onExport: (message) => void handleExportMessage(message),
                    onSaveAsPrompt: (message) => void handleSaveMessageAsPrompt(message),
                  }}
                  scrollToMessageId={scrollToMessageId}
                  highlightMessageId={highlightMessageId}
                />
              )}
            </section>

            <ChatComposer
              value={draft}
              onChange={setDraft}
              onSubmit={() => void handleSend()}
              onStop={() => abortRef.current?.abort()}
              isStreaming={isStreaming}
              disabled={chatDisabled}
              showSuggestions={(activeConversation?.messages.length ?? 0) === 0}
              onSuggestionSelect={(value) => {
                setDraft(value);
                void handleSend(value);
              }}
              onSlashCommand={handleSlashCommand}
              onAttach={() => setActiveView("knowledge")}
              placeholder={
                chatDisabled
                  ? "Connect Ollama and select available models to chat"
                  : "Message LocalChat"
              }
            />
          </>
        )}
      </AppShell>

      <CommandPalette
        open={commandOpen}
        query={commandQuery}
        items={commandItems}
        recentConversations={conversations}
        onQueryChange={setCommandQuery}
        onClose={() => {
          setCommandOpen(false);
          setCommandQuery("");
        }}
        onSearchNavigate={(hit) => void handleSearchNavigate(hit)}
        onSelectConversation={(conversation) => {
          setActiveView("chat");
          void selectConversation(conversation.id);
        }}
      />

      <PromptComposerModal
        open={promptComposerOpen}
        onClose={() => setPromptComposerOpen(false)}
        onLaunchConversation={(payload) => void handleLaunchFromPrompt(payload)}
      />
    </>
  );
}
