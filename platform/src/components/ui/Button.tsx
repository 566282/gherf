import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  fullWidth = false,
  className,
  children,
  ...props
}: PropsWithChildren<ButtonProps>): JSX.Element {
  return (
    <button
      {...props}
      className={clsx(
        'relative overflow-hidden rounded-xl px-4 py-2.5 font-medium tracking-tight transform-gpu transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60',
        'before:pointer-events-none before:absolute before:inset-0 before:translate-x-[-130%] before:bg-gradient-to-r before:from-transparent before:via-white/15 before:to-transparent before:transition-transform before:duration-700 hover:before:translate-x-[130%]',
        variant === 'primary' && 'bg-accent text-accent-foreground shadow-[0_10px_30px_hsl(var(--color-accent)/0.24)] hover:bg-accent-strong hover:-translate-y-0.5',
        variant === 'ghost' && 'border border-border bg-surface text-foreground hover:border-accent/40 hover:bg-accent-soft hover:-translate-y-0.5',
        fullWidth && 'w-full',
        className,
      )}
    >
      {children}
    </button>
  );
}
