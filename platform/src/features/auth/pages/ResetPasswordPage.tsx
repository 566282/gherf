import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { updatePassword } from '@/services/api/auth';

export function ResetPasswordPage(): JSX.Element {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [touched, setTouched] = useState({ password: false, confirmPassword: false });

  const fieldErrors = useMemo(() => {
    const nextErrors: { password?: string; confirmPassword?: string } = {};

    if (password.length < 8) {
      nextErrors.password = 'Use at least 8 characters.';
    }

    if (confirmPassword && password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    return nextErrors;
  }, [confirmPassword, password]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setTouched({ password: true, confirmPassword: true });

    if (fieldErrors.password || fieldErrors.confirmPassword) {
      setMessage('Please resolve the highlighted password errors.');
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setSuccessMessage(null);

    try {
      await updatePassword(password);
      setSuccessMessage('Password updated successfully. Redirecting to sign in.');
      navigate('/login', { replace: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-transition grid min-h-[70vh] place-items-center px-4 py-12">
      <Card className="w-full max-w-md border border-white/10 bg-white/5 interactive-card">
        <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Recovery</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Choose a new password</h1>
        <p className="mt-2 text-sm text-mist/80">Finish account recovery by setting a new password.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <label className="grid gap-2" htmlFor="reset-password">
            <span className="text-sm text-mist/70">New password</span>
            <input
              id="reset-password"
              className="input-base"
              type="password"
              placeholder="New password"
              value={password}
              onBlur={() => setTouched((current) => ({ ...current, password: true }))}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean((touched.password || message) && fieldErrors.password)}
              aria-describedby="reset-password-hint reset-password-error"
              required
            />
            <p id="reset-password-hint" className="form-hint">Use at least 8 characters for a stronger account recovery password.</p>
            {(touched.password || message) && fieldErrors.password ? <p id="reset-password-error" className="form-error">{fieldErrors.password}</p> : null}
          </label>
          <label className="grid gap-2" htmlFor="reset-password-confirm">
            <span className="text-sm text-mist/70">Confirm password</span>
            <input
              id="reset-password-confirm"
              className="input-base"
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onBlur={() => setTouched((current) => ({ ...current, confirmPassword: true }))}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={Boolean((touched.confirmPassword || message) && fieldErrors.confirmPassword)}
              aria-describedby="reset-password-confirm-hint reset-password-confirm-error"
              required
            />
            <p id="reset-password-confirm-hint" className="form-hint">Repeat the new password exactly.</p>
            {(touched.confirmPassword || message) && fieldErrors.confirmPassword ? (
              <p id="reset-password-confirm-error" className="form-error">{fieldErrors.confirmPassword}</p>
            ) : null}
          </label>
          {message ? <p className="form-error" role="alert">{message}</p> : null}
          {successMessage ? <p className="form-success" role="status">{successMessage}</p> : null}
          <Button type="submit" fullWidth disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Update password'}</Button>
        </form>
      </Card>
    </div>
  );
}
