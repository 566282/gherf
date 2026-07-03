import { Card } from '@/components/ui/Card';
import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <Card className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold text-ember mb-4">Campaign Reward Platform</h1>
        <p className="text-mist mb-8">
          Earn rewards by completing marketing campaign tasks. Businesses launch campaigns, users
          complete tasks, get rewarded.
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/login" className="px-6 py-3 bg-ember rounded-lg hover:bg-orange-600 transition">
            Login
          </Link>
          <Link
            to="/signup"
            className="px-6 py-3 bg-mint rounded-lg text-ink hover:bg-green-600 transition"
          >
            Sign Up
          </Link>
        </div>
      </Card>
    </div>
  );
}
