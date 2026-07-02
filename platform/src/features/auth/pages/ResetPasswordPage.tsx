import { useState } from 'react';
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      await updatePassword(password);
      navigate('/login', { replace: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-[70vh] place-items-center px-4 py-12">
      <Card className="w-full max-w-md">
        <p className="text-sm uppercase tracking-[0.2em] text-mint">Recovery</p>
        <h1 className="mt-2 text-2xl font-bold">Choose a new password</h1>
        <p className="mt-2 text-sm text-mist/80">Finish account recovery by setting a new password.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input className="input-base" type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <input className="input-base" type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          {message ? <p className="text-sm text-red-300">{message}</p> : null}
          <Button type="submit" fullWidth disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Update password'}</Button>
        </form>
      </Card>
    </div>
  );
}
