import type { PropsWithChildren } from 'react';
import clsx from 'clsx';

interface CardProps {
  className?: string;
}

export function Card({ children, className }: PropsWithChildren<CardProps>): JSX.Element {
  return <section className={clsx('glass-card p-6', className)}>{children}</section>;
}
