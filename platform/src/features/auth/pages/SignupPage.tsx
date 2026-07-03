import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { env } from '@/lib/env';
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
  const [captchaToken, setCaptchaToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    if (env.captchaEnabled && !captchaToken.trim()) {
      setMessage('Complete CAPTCHA verification before creating an account.');
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      await signUp(email, password, fullName, referralCode || undefined, role, captchaToken || undefined);
      navigate('/login', { replace: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-[70vh] place-items-center px-4 py-12">
      <Card className="w-full max-w-xl">
        <p className="text-sm uppercase tracking-[0.2em] text-mint">Onboarding</p>
        <h1 className="mt-2 text-2xl font-bold">Create account</h1>
        <p className="mt-2 text-sm text-mist/80">Email signup, optional referral tracking, and role-based onboarding.</p>
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
          <input className="input-base md:col-span-2" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <input className="input-base md:col-span-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input-base" placeholder="Referral code (optional)" value={referralCode} onChange={(e) => setReferralCode(e.target.value.toUpperCase())} />
          <select className="input-base" value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {env.captchaEnabled ? (
            <input
              className="input-base md:col-span-2"
              placeholder="CAPTCHA token"
              value={captchaToken}
              onChange={(e) => setCaptchaToken(e.target.value)}
              required
            />
          ) : null}
          <input className="input-base" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <input className="input-base" type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          {message ? <p className="md:col-span-2 text-sm text-red-300">{message}</p> : null}
          <div className="md:col-span-2 flex flex-wrap gap-3">
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account...' : 'Create account'}</Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/login')}>Back to sign in</Button>
          </div>
        </form>
        <p className="mt-4 text-sm text-mist/70">Already have an account? <Link to="/login" className="text-ember">Sign in</Link></p>
      </Card>
    </div>
  );
}
