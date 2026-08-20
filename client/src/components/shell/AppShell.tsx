import type { ReactNode } from "react";
import { IconButton } from "../ui/Primitives";

interface AppShellProps {
  leftSidebar: ReactNode;
  rightPanel?: ReactNode;
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onCloseDrawers: () => void;
  isMobile: boolean;
  children: ReactNode;
}

export function AppShell({
  leftSidebar,
  rightPanel,
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
  onCloseDrawers,
  isMobile,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-base text-primary">
      {!isMobile ? (
        <aside
          aria-label="Conversation sidebar"
          className={`motion-standard shrink-0 border-r border-border-subtle bg-elevated ${leftOpen ? "w-sidebar" : "w-0 overflow-hidden opacity-0"}`}
        >
          {leftOpen ? leftSidebar : null}
        </aside>
      ) : (
        <>
          {leftOpen ? (
            <button
              type="button"
              aria-label="Close sidebar"
              className="drawer-backdrop fixed inset-0 z-40"
              onClick={onCloseDrawers}
            />
          ) : null}
          <aside
            aria-label="Conversation sidebar"
            className={`motion-standard fixed inset-y-0 left-0 z-50 w-sidebar border-r border-border-subtle bg-elevated shadow-overlay ${leftOpen ? "translate-x-0" : "-translate-x-full"}`}
          >
            {leftSidebar}
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2 lg:hidden">
          <IconButton label="Toggle sidebar" onClick={onToggleLeft}>
            ☰
          </IconButton>
          {rightPanel ? (
            <IconButton label="Toggle context panel" onClick={onToggleRight}>
              ⧉
            </IconButton>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1">
          <main className="flex min-w-0 flex-[1_1_0%] flex-col">{children}</main>
          {!isMobile && rightPanel ? (
            <aside
              aria-label="Context panel"
              className={`motion-standard max-w-[28vw] shrink-0 border-l border-border-subtle bg-elevated ${rightOpen ? "w-context" : "w-0 overflow-hidden opacity-0"}`}
            >
              {rightOpen ? rightPanel : null}
            </aside>
          ) : null}
        </div>
      </div>

      {isMobile && rightPanel ? (
        <>
          {rightOpen ? (
            <button
              type="button"
              aria-label="Close context panel"
              className="drawer-backdrop fixed inset-0 z-40"
              onClick={onCloseDrawers}
            />
          ) : null}
          <aside
            aria-label="Context panel"
            className={`motion-standard fixed inset-y-0 right-0 z-50 w-full max-w-context border-l border-border-subtle bg-elevated shadow-overlay ${rightOpen ? "translate-x-0" : "translate-x-full"}`}
          >
            {rightPanel}
          </aside>
        </>
      ) : null}
    </div>
  );
}
