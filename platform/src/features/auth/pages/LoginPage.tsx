import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { env } from '@/lib/env';
import { signIn, signInWithGoogle } from '@/services/api/auth';

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (env.captchaEnabled && !captchaToken.trim()) {
      setError('Complete CAPTCHA verification before signing in.');
      setIsSubmitting(false);
      return;
    }

    try {
      await signIn(email, password, captchaToken || undefined);
      navigate('/app', { replace: true });
    } catch (authenticationError) {
      setError(authenticationError instanceof Error ? authenticationError.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-[70vh] place-items-center px-4 py-12">
      <Card className="w-full max-w-md">
        <p className="text-sm uppercase tracking-[0.2em] text-mint">Authentication</p>
        <h1 className="mt-2 text-2xl font-bold">Sign in</h1>
        <p className="mt-2 text-sm text-mist/80">Use your email, Google, or a password reset flow to access the platform.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input className="input-base" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input-base" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {env.captchaEnabled ? (
            <input
              className="input-base"
              placeholder="CAPTCHA token"
              value={captchaToken}
              onChange={(e) => setCaptchaToken(e.target.value)}
              required
            />
          ) : null}
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <Button type="submit" fullWidth disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Sign in'}</Button>
        </form>
        <div className="mt-4 space-y-3">
          <Button type="button" variant="ghost" fullWidth onClick={() => void signInWithGoogle().catch(() => setError('Google sign-in is unavailable right now.'))}>
            Continue with Google
          </Button>
          <div className="flex items-center justify-between text-sm text-mist/75">
            <Link to="/signup" className="hover:text-ember">Create account</Link>
            <Link to="/forgot-password" className="hover:text-ember">Forgot password?</Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
