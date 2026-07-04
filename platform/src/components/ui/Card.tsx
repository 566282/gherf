import type { PropsWithChildren } from 'react';
import clsx from 'clsx';

interface CardProps {
  className?: string;
}

export function Card({ children, className }: PropsWithChildren<CardProps>): JSX.Element {
  return <section className={clsx('glass-card p-6 transition-shadow duration-300 hover:shadow-[0_20px_60px_hsl(var(--color-background)/0.35)]', className)}>{children}</section>;
}
