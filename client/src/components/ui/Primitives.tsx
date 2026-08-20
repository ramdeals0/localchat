import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-[var(--color-text-inverse)] hover:brightness-105 border border-transparent",
  secondary:
    "bg-elevated text-primary border border-border-subtle hover:bg-muted",
  ghost: "bg-transparent text-secondary hover:bg-muted hover:text-primary border border-transparent",
  danger:
    "bg-transparent text-danger border border-danger/30 hover:bg-danger/10",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`motion-standard inline-flex items-center justify-center gap-2 rounded-lg font-medium disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`motion-standard inline-flex h-9 w-9 items-center justify-center rounded-lg text-secondary hover:bg-muted hover:text-primary disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const tones = {
    neutral: "bg-muted text-secondary border-border-subtle",
    accent: "bg-accent-muted text-accent-text border-accent/20",
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/30",
    danger: "bg-danger/10 text-danger border-danger/30",
    info: "bg-info/10 text-info border-info/30",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-muted ${className}`}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle px-6 py-12 text-center">
      <h3 className="text-lg font-medium text-primary">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-secondary">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
