import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps): JSX.Element {
  return <div className={clsx('skeleton rounded-xl', className)} aria-hidden="true" />;
}