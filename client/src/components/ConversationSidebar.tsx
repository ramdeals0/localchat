import type { Conversation } from "@localchat/shared";

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: ConversationSidebarProps) {
  return (
    <aside className="flex h-full w-72 flex-col border-r border-surface-border bg-[#0b1220]">
      <div className="border-b border-surface-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white">LocalChat</h1>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-black hover:bg-green-400"
        >
          New conversation
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 ? (
          <p className="px-2 py-4 text-sm text-gray-500">No conversations yet.</p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((conversation) => {
              const active = conversation.id === activeId;
              return (
                <li key={conversation.id}>
                  <div
                    className={`group rounded-lg border px-3 py-2 ${
                      active
                        ? "border-accent/60 bg-accent/10"
                        : "border-transparent hover:border-surface-border hover:bg-surface-raised"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(conversation.id)}
                      className="w-full text-left"
                    >
                      <div className="truncate text-sm font-medium text-gray-100">
                        {conversation.title}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {conversation.model}
                      </div>
                    </button>
                    <div className="mt-2 hidden gap-2 group-hover:flex">
                      <button
                        type="button"
                        className="text-xs text-gray-400 hover:text-white"
                        onClick={() => {
                          const next = window.prompt(
                            "Rename conversation",
                            conversation.title,
                          );
                          if (next?.trim()) {
                            onRename(conversation.id, next.trim());
                          }
                        }}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-400 hover:text-red-300"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete "${conversation.title}"? This cannot be undone.`,
                            )
                          ) {
                            onDelete(conversation.id);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </aside>
  );
}
