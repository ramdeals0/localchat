import { useCallback, useEffect, useState } from "react";
import type { OllamaStatus } from "@localchat/shared";
import { fetchStatus } from "../api/client";

export function useOllamaStatus(selectedModel?: string) {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchStatus(selectedModel);
      setStatus(next);
    } catch {
      setStatus({
        online: false,
        defaultModel: selectedModel ?? "qwen2.5:7b",
        selectedModelAvailable: false,
        models: [],
        error: "Unable to reach LocalChat server",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedModel]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return { status, loading, refresh };
}
