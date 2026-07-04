import { Card } from '@/components/ui/Card';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="max-w-md w-full border border-white/10 bg-white/5 text-center">
        <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Not found</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">404 - Page not found</h1>
        <p className="mt-3 text-mist/80">The page you're looking for doesn't exist.</p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-xl bg-mint px-6 py-2 font-medium text-ink shadow-[0_10px_30px_rgba(95,175,150,0.18)] transition hover:bg-[#74bea7]"
        >
          Back to Home
        </Link>
      </Card>
    </div>
  );
}
