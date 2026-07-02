import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function HomePage(): JSX.Element {
  return (
    <section className="grid min-h-[70vh] content-center gap-8">
      <div className="max-w-3xl">
        <p className="text-sm uppercase tracking-[0.25em] text-mint">Production-ready foundation</p>
        <h1 className="mt-3 text-4xl font-bold leading-tight md:text-6xl">
          Configurable campaign engine for businesses and reward-seeking users.
        </h1>
        <p className="mt-5 text-lg text-mist/80">
          Database-driven rules, role-based control planes, and secure Supabase auth with mobile-first UX.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/login">
          <Button>Sign in</Button>
        </Link>
        <Link to="/dashboard">
          <Button variant="ghost">Open platform</Button>
        </Link>
      </div>
    </section>
  );
}
