import { useToast, type ToastTone } from "./ToastProvider";

const toneStyles: Record<ToastTone, string> = {
  info: "border-info/30 bg-elevated text-primary",
  success: "border-success/30 bg-elevated text-primary",
  warning: "border-warning/40 bg-elevated text-primary",
  error: "border-danger/40 bg-elevated text-primary",
};

const toneLabels: Record<ToastTone, string> = {
  info: "Information",
  success: "Success",
  warning: "Warning",
  error: "Error",
};

export function ToastViewport() {
  const { toasts, dismissToast } = useToast();

  return (
    <div
      aria-live="polite"
      aria-relevant="additions text"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-3"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`pointer-events-auto motion-standard rounded-xl border px-4 py-3 shadow-overlay ${toneStyles[toast.tone]}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                <span className="sr-only">{toneLabels[toast.tone]}: </span>
                {toast.title}
              </p>
              {toast.description ? (
                <p className="mt-1 text-sm text-secondary">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismissToast(toast.id)}
              className="rounded-md px-2 py-1 text-secondary hover:bg-muted hover:text-primary"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
