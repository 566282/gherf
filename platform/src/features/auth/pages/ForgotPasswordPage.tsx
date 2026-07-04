import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { requestPasswordReset, resendVerificationEmail } from '@/services/api/auth';

export function ForgotPasswordPage(): JSX.Element {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const emailError = !email.trim() ? 'Email is required.' : /^\S+@\S+\.\S+$/.test(email) ? null : 'Enter a valid email address.';

  const handleReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);

    if (emailError) {
      setMessage('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      await requestPasswordReset(email);
      setMessage('Password reset email sent. Check your inbox.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to send reset email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-transition grid min-h-[70vh] place-items-center px-4 py-12">
      <Card className="w-full max-w-md border border-white/10 bg-white/5 interactive-card">
        <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Recovery</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Reset password</h1>
        <p className="mt-2 text-sm text-mist/80">Send a recovery link or resend your verification email.</p>
        <form onSubmit={handleReset} className="mt-6 space-y-4" noValidate>
          <label className="grid gap-2" htmlFor="forgot-email">
            <span className="text-sm text-mist/70">Email address</span>
            <input
              id="forgot-email"
              className="input-base"
              type="email"
              placeholder="Email"
              value={email}
              onBlur={() => setTouched(true)}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(touched && emailError)}
              aria-describedby="forgot-email-hint forgot-email-error"
              required
            />
            <p id="forgot-email-hint" className="form-hint">We’ll send recovery and verification messages to this inbox.</p>
            {touched && emailError ? <p id="forgot-email-error" className="form-error">{emailError}</p> : null}
          </label>
          {message ? <p className="form-success" role="status">{message}</p> : null}
          <Button type="submit" fullWidth disabled={isSubmitting}>{isSubmitting ? 'Sending...' : 'Send reset link'}</Button>
          <Button
            type="button"
            variant="ghost"
            fullWidth
            onClick={() => void resendVerificationEmail(email).then(() => setMessage('Verification email resent.')).catch((error) => setMessage(error instanceof Error ? error.message : 'Unable to resend verification email.'))}
          >
            Resend verification email
          </Button>
        </form>
        <p className="mt-4 text-sm text-mist/70"><Link to="/login" className="text-ember/90 transition hover:text-ember">Back to sign in</Link></p>
      </Card>
    </div>
  );
}
