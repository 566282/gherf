import { Card } from '@/components/ui/Card';

export function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-ember mb-4">403 - Unauthorized</h1>
        <p className="text-mist mb-6">You don't have permission to access this page.</p>
        <a href="/app" className="inline-block px-6 py-2 bg-mint text-ink rounded-lg hover:bg-green-600">
          Back to Dashboard
        </a>
      </Card>
    </div>
  );
}
