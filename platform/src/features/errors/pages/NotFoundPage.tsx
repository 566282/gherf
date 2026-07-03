import { Card } from '@/components/ui/Card';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-ember mb-4">404 - Not Found</h1>
        <p className="text-mist mb-6">The page you're looking for doesn't exist.</p>
        <Link
          to="/"
          className="inline-block px-6 py-2 bg-mint text-ink rounded-lg hover:bg-green-600"
        >
          Back to Home
        </Link>
      </Card>
    </div>
  );
}
