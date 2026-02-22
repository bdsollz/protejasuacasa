import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, helperText, errorText, id, required, className, disabled, ...props },
  ref
) {
  const generatedId = useId();
  const fieldId = id ?? `field-${generatedId}`;
  const helpId = `${fieldId}-help`;
  const errId = `${fieldId}-err`;
  const isError = Boolean(errorText);

  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="text-label text-[var(--color-muted)]">
        {label} {required ? <span aria-hidden="true">*</span> : null}
      </label>
      <input
        ref={ref}
        id={fieldId}
        required={required}
        disabled={disabled}
        aria-invalid={isError || undefined}
        aria-describedby={isError ? errId : helperText ? helpId : undefined}
        className={cn(
          "focus-ring w-full rounded-md border px-3 py-2.5 text-body",
          "bg-transparent border-[var(--color-border)]",
          "placeholder:text-[var(--color-muted)]/80",
          "disabled:cursor-not-allowed disabled:opacity-60",
          isError && "border-[var(--color-danger)] focus-visible:ring-[var(--color-danger)]",
          className
        )}
        {...props}
      />
      {isError ? (
        <p id={errId} className="text-small text-[var(--color-danger)]">
          {errorText}
        </p>
      ) : helperText ? (
        <p id={helpId} className="text-small text-[var(--color-muted)]">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});
