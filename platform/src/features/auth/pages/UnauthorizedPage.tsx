import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';

export function UnauthorizedPage(): JSX.Element {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Card className="max-w-xl text-center">
        <h1 className="text-2xl font-bold">Access denied</h1>
        <p className="mt-3 text-mist/80">Your role does not have permission to access this area.</p>
        <Link to="/dashboard" className="mt-6 inline-block text-ember hover:text-[#ff902f]">
          Return to dashboard
        </Link>
      </Card>
    </div>
  );
}
