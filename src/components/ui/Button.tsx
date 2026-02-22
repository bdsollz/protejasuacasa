import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
};

const styles: Record<ButtonVariant, string> = {
  primary:
    "text-white [background:var(--gradient-cta)] border border-transparent hover:brightness-110 active:brightness-95",
  secondary:
    "text-[var(--color-text)] bg-transparent border border-[var(--color-border)] hover:bg-white/5 active:bg-white/10",
  ghost:
    "text-[var(--color-text)] bg-transparent border border-transparent hover:bg-white/5 active:bg-white/10",
  danger:
    "text-white bg-[var(--color-danger)] border border-transparent hover:brightness-110 active:brightness-95"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, children, variant = "primary", loading = false, disabled, ...props },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-pill px-4 py-2.5 text-sm font-semibold",
        "transition-all duration-150 ease-premium",
        "disabled:cursor-not-allowed disabled:opacity-60",
        styles[variant],
        className
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 animate-spin"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="12" cy="12" r="9" className="stroke-white/30" strokeWidth="3" fill="none" />
          <path d="M12 3a9 9 0 0 1 9 9" className="stroke-white" strokeWidth="3" fill="none" />
        </svg>
      ) : null}
      <span>{children}</span>
    </button>
  );
});
