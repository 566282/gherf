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
        'rounded-xl px-4 py-2 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember',
        variant === 'primary' && 'bg-ember text-ink hover:bg-[#ff902f]',
        variant === 'ghost' && 'bg-white/10 text-mist hover:bg-white/20',
        fullWidth && 'w-full',
        className,
      )}
    >
      {children}
    </button>
  );
}
