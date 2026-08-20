import { useCallback, useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export function usePinnedConversations() {
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("localchat:pinned") ?? "[]",
      ) as string[];
    } catch {
      return [];
    }
  });

  const togglePin = useCallback((id: string) => {
    setPinnedIds((current) => {
      const next = current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id];
      localStorage.setItem("localchat:pinned", JSON.stringify(next));
      return next;
    });
  }, []);

  return { pinnedIds, togglePin };
}

export function useKeyboardShortcuts(
  bindings: Array<{
    key: string;
    ctrlOrMeta?: boolean;
    shift?: boolean;
    handler: () => void;
  }>,
) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      for (const binding of bindings) {
        const meta = binding.ctrlOrMeta
          ? event.metaKey || event.ctrlKey
          : true;
        if (!meta) {
          continue;
        }
        if (binding.shift !== undefined && event.shiftKey !== binding.shift) {
          continue;
        }
        if (event.key.toLowerCase() === binding.key.toLowerCase()) {
          event.preventDefault();
          binding.handler();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bindings]);
}

export function groupConversationsByDate<T extends { updatedAt: number }>(
  items: T[],
): Array<{ label: string; items: T[] }> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const startOfWeek = startOfToday - 6 * 86_400_000;

  const groups: Record<string, T[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    Older: [],
  };

  for (const item of items) {
    if (item.updatedAt >= startOfToday) {
      groups.Today!.push(item);
    } else if (item.updatedAt >= startOfYesterday) {
      groups.Yesterday!.push(item);
    } else if (item.updatedAt >= startOfWeek) {
      groups["Previous 7 days"]!.push(item);
    } else {
      groups.Older!.push(item);
    }
  }

  return Object.entries(groups)
    .filter(([, groupItems]) => groupItems.length > 0)
    .map(([label, groupItems]) => ({ label, items: groupItems }));
}
