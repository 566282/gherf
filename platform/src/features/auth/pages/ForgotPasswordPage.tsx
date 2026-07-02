import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { requestPasswordReset, resendVerificationEmail } from '@/services/api/auth';

export function ForgotPasswordPage(): JSX.Element {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    <div className="grid min-h-[70vh] place-items-center px-4 py-12">
      <Card className="w-full max-w-md">
        <p className="text-sm uppercase tracking-[0.2em] text-mint">Recovery</p>
        <h1 className="mt-2 text-2xl font-bold">Reset password</h1>
        <p className="mt-2 text-sm text-mist/80">Send a recovery link or resend your verification email.</p>
        <form onSubmit={handleReset} className="mt-6 space-y-4">
          <input className="input-base" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {message ? <p className="text-sm text-mist">{message}</p> : null}
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
        <p className="mt-4 text-sm text-mist/70"><Link to="/login" className="text-ember">Back to sign in</Link></p>
      </Card>
    </div>
  );
}
