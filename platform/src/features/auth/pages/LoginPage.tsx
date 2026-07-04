import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { signIn, signInWithGoogle } from '@/services/api/auth';

function isValidEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value);
}

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [touched, setTouched] = useState({ email: false, password: false });

  const fieldErrors = useMemo(() => {
    const nextErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      nextErrors.email = 'Email is required.';
    } else if (!isValidEmail(email)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!password.trim()) {
      nextErrors.password = 'Password is required.';
    }

    return nextErrors;
  }, [email, password]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ email: true, password: true });

    if (fieldErrors.email || fieldErrors.password) {
      setError('Please fix the highlighted fields.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await signIn(email, password);
      setSuccessMessage('Signed in successfully. Redirecting to your dashboard.');
      navigate('/app', { replace: true });
    } catch (authenticationError) {
      setError(authenticationError instanceof Error ? authenticationError.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-transition grid min-h-[70vh] place-items-center px-4 py-12">
      <Card className="w-full max-w-md border border-white/10 bg-white/5 interactive-card">
        <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Authentication</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Sign in</h1>
        <p className="mt-2 text-sm text-mist/80">Use your email, Google, or a password reset flow to access Go4Wealth.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <label className="grid gap-2" htmlFor="login-email">
            <span className="text-sm text-mist/70">Email address</span>
            <input
              id="login-email"
              className="input-base"
              type="email"
              placeholder="Email"
              value={email}
              onBlur={() => setTouched((current) => ({ ...current, email: true }))}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean((touched.email || error) && fieldErrors.email)}
              aria-describedby="login-email-hint login-email-error"
              required
            />
            <p id="login-email-hint" className="form-hint">Use the email tied to your account.</p>
            {(touched.email || error) && fieldErrors.email ? <p id="login-email-error" className="form-error">{fieldErrors.email}</p> : null}
          </label>
          <label className="grid gap-2" htmlFor="login-password">
            <span className="text-sm text-mist/70">Password</span>
            <input
              id="login-password"
              className="input-base"
              type="password"
              placeholder="Password"
              value={password}
              onBlur={() => setTouched((current) => ({ ...current, password: true }))}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean((touched.password || error) && fieldErrors.password)}
              aria-describedby="login-password-hint login-password-error"
              required
            />
            <p id="login-password-hint" className="form-hint">Passwords are case sensitive.</p>
            {(touched.password || error) && fieldErrors.password ? <p id="login-password-error" className="form-error">{fieldErrors.password}</p> : null}
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {successMessage ? <p className="form-success" role="status">{successMessage}</p> : null}
          <Button type="submit" fullWidth disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Sign in'}</Button>
        </form>
        <div className="mt-4 space-y-3">
          <Button type="button" variant="ghost" fullWidth onClick={() => void signInWithGoogle().catch(() => setError('Google sign-in is unavailable right now.'))}>
            Continue with Google
          </Button>
          <div className="flex items-center justify-between text-sm text-mist/75">
            <Link to="/signup" className="transition hover:text-ember">Create account</Link>
            <Link to="/forgot-password" className="transition hover:text-ember">Forgot password?</Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
