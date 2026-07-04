import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { signUp } from '@/services/api/auth';
import type { AppRole } from '@/types/auth';

const roleOptions: Array<{ value: AppRole; label: string }> = [
  { value: 'registered_user', label: 'User' },
  { value: 'advertiser', label: 'Advertiser' },
];

export function SignupPage(): JSX.Element {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [role, setRole] = useState<AppRole>('registered_user');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [touched, setTouched] = useState({ fullName: false, email: false, password: false, confirmPassword: false });

  const fieldErrors = useMemo(() => {
    const nextErrors: { fullName?: string; email?: string; password?: string; confirmPassword?: string } = {};

    if (!fullName.trim()) {
      nextErrors.fullName = 'Full name is required.';
    }

    if (!email.trim()) {
      nextErrors.email = 'Email is required.';
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (password.length < 8) {
      nextErrors.password = 'Use at least 8 characters.';
    }

    if (confirmPassword && password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    return nextErrors;
  }, [confirmPassword, email, fullName, password]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setTouched({ fullName: true, email: true, password: true, confirmPassword: true });

    if (fieldErrors.fullName || fieldErrors.email || fieldErrors.password || fieldErrors.confirmPassword) {
      setMessage('Please resolve the highlighted validation errors.');
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setSuccessMessage(null);

    try {
      await signUp(email, password, fullName, referralCode || undefined, role);
      setSuccessMessage('Account created successfully. Redirecting to sign in.');
      navigate('/login', { replace: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-transition grid min-h-[70vh] place-items-center px-4 py-12">
      <Card className="w-full max-w-xl border border-white/10 bg-white/5 interactive-card">
        <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Onboarding</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Create account</h1>
        <p className="mt-2 text-sm text-mist/80">Email signup, optional referral tracking, and role-based onboarding.</p>
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2" noValidate>
          <label className="grid gap-2 md:col-span-2" htmlFor="signup-full-name">
            <span className="text-sm text-mist/70">Full name</span>
            <input
              id="signup-full-name"
              className="input-base"
              placeholder="Full name"
              value={fullName}
              onBlur={() => setTouched((current) => ({ ...current, fullName: true }))}
              onChange={(e) => setFullName(e.target.value)}
              aria-invalid={Boolean((touched.fullName || message) && fieldErrors.fullName)}
              aria-describedby="signup-full-name-hint signup-full-name-error"
              required
            />
            <p id="signup-full-name-hint" className="form-hint">This name appears on your profile and leaderboard entries.</p>
            {(touched.fullName || message) && fieldErrors.fullName ? <p id="signup-full-name-error" className="form-error">{fieldErrors.fullName}</p> : null}
          </label>
          <label className="grid gap-2 md:col-span-2" htmlFor="signup-email">
            <span className="text-sm text-mist/70">Email address</span>
            <input
              id="signup-email"
              className="input-base"
              type="email"
              placeholder="Email"
              value={email}
              onBlur={() => setTouched((current) => ({ ...current, email: true }))}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean((touched.email || message) && fieldErrors.email)}
              aria-describedby="signup-email-hint signup-email-error"
              required
            />
            <p id="signup-email-hint" className="form-hint">We’ll use this for sign-in, verification, and account recovery.</p>
            {(touched.email || message) && fieldErrors.email ? <p id="signup-email-error" className="form-error">{fieldErrors.email}</p> : null}
          </label>
          <label className="grid gap-2" htmlFor="signup-referral">
            <span className="text-sm text-mist/70">Referral code</span>
            <input
              id="signup-referral"
              className="input-base"
              placeholder="Referral code (optional)"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
            />
            <p className="form-hint">Optional. Leave blank if you were not referred.</p>
          </label>
          <label className="grid gap-2" htmlFor="signup-role">
            <span className="text-sm text-mist/70">Role</span>
            <select id="signup-role" className="input-base" value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
            </select>
            <p className="form-hint">Choose the account experience you need on day one.</p>
          </label>
          <label className="grid gap-2" htmlFor="signup-password">
            <span className="text-sm text-mist/70">Password</span>
            <input
              id="signup-password"
              className="input-base"
              type="password"
              placeholder="Password"
              value={password}
              onBlur={() => setTouched((current) => ({ ...current, password: true }))}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean((touched.password || message) && fieldErrors.password)}
              aria-describedby="signup-password-hint signup-password-error"
              required
            />
            <p id="signup-password-hint" className="form-hint">Use at least 8 characters.</p>
            {(touched.password || message) && fieldErrors.password ? <p id="signup-password-error" className="form-error">{fieldErrors.password}</p> : null}
          </label>
          <label className="grid gap-2" htmlFor="signup-confirm-password">
            <span className="text-sm text-mist/70">Confirm password</span>
            <input
              id="signup-confirm-password"
              className="input-base"
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onBlur={() => setTouched((current) => ({ ...current, confirmPassword: true }))}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={Boolean((touched.confirmPassword || message) && fieldErrors.confirmPassword)}
              aria-describedby="signup-confirm-password-hint signup-confirm-password-error"
              required
            />
            <p id="signup-confirm-password-hint" className="form-hint">Repeat the password exactly to continue.</p>
            {(touched.confirmPassword || message) && fieldErrors.confirmPassword ? (
              <p id="signup-confirm-password-error" className="form-error">{fieldErrors.confirmPassword}</p>
            ) : null}
          </label>
          {message ? <p className="md:col-span-2 form-error" role="alert">{message}</p> : null}
          {successMessage ? <p className="md:col-span-2 form-success" role="status">{successMessage}</p> : null}
          <div className="md:col-span-2 flex flex-wrap gap-3">
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account...' : 'Create account'}</Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/login')}>Back to sign in</Button>
          </div>
        </form>
        <p className="mt-4 text-sm text-mist/70">Already have an account? <Link to="/login" className="text-ember/90 transition hover:text-ember">Sign in</Link></p>
      </Card>
    </div>
  );
}
