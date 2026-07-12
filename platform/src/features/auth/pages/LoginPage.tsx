import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  getCurrentProfile,
  requestPhoneOtp,
  signIn,
  signInWithApple,
  signInWithFacebook,
  signInWithGoogle,
  verifyPhoneOtp,
} from '@/services/api/auth';

function isValidEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value);
}

function getPostLoginRoute(role: string | undefined): string {
  switch (role) {
    case 'super_admin':
      return '/admin';
    case 'advertiser':
    case 'campaign_manager':
      return '/business';
    case 'registered_user':
    case 'moderator':
    case 'guest':
    default:
      return '/app';
  }
}

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const [loginMode, setLoginMode] = useState<'password' | 'phone'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(false);
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
    if (loginMode !== 'password') {
      return;
    }

    setTouched({ email: true, password: true });

    if (fieldErrors.email || fieldErrors.password) {
      setError('Please fix the highlighted fields.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await signIn(email, password, rememberLogin);
      const profile = await getCurrentProfile();
      setSuccessMessage('Signed in successfully. Redirecting to your dashboard.');
      navigate(getPostLoginRoute(profile?.role), { replace: true });
    } catch (authenticationError) {
      setError(authenticationError instanceof Error ? authenticationError.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onRequestOtp = async () => {
    setError(null);
    setSuccessMessage(null);

    if (!phone.trim()) {
      setError('Enter a phone number in E.164 format, for example +14155550123.');
      return;
    }

    setIsSubmitting(true);
    try {
      await requestPhoneOtp(phone.trim());
      setOtpRequested(true);
      setSuccessMessage('OTP sent. Enter the verification code to continue.');
    } catch (otpError) {
      setError(otpError instanceof Error ? otpError.message : 'Unable to send OTP code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onVerifyOtp = async () => {
    setError(null);
    setSuccessMessage(null);

    if (!otpCode.trim()) {
      setError('Enter the OTP code.');
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyPhoneOtp(phone.trim(), otpCode.trim(), rememberLogin);
      const profile = await getCurrentProfile();
      setSuccessMessage('Phone verified. Redirecting to your dashboard.');
      navigate(getPostLoginRoute(profile?.role), { replace: true });
    } catch (otpError) {
      setError(otpError instanceof Error ? otpError.message : 'Unable to verify OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-transition grid min-h-[70vh] place-items-center px-4 py-12">
      <Card className="w-full max-w-md border border-white/10 bg-white/5 interactive-card">
        <p className="text-sm uppercase tracking-[0.24em] text-mint/70">Authentication</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Sign in</h1>
        <p className="mt-2 text-sm text-mist/80">Use email, social login, or phone OTP to access Go4Wealth.</p>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/5 p-1 text-sm">
          <button
            type="button"
            className={`rounded-lg px-3 py-2 transition ${loginMode === 'password' ? 'bg-mint/20 text-white' : 'text-mist/80 hover:bg-white/10'}`}
            onClick={() => setLoginMode('password')}
          >
            Password login
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 transition ${loginMode === 'phone' ? 'bg-mint/20 text-white' : 'text-mist/80 hover:bg-white/10'}`}
            onClick={() => setLoginMode('phone')}
          >
            Phone OTP
          </button>
        </div>

        {loginMode === 'password' ? <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
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
          <label className="flex items-center gap-2 text-sm text-mist/80">
            <input type="checkbox" checked={rememberLogin} onChange={(event) => setRememberLogin(event.target.checked)} />
            Remember this login for 7 days
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {successMessage ? <p className="form-success" role="status">{successMessage}</p> : null}
          <Button type="submit" fullWidth disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Sign in'}</Button>
        </form> : <div className="mt-6 space-y-4">
          <label className="grid gap-2" htmlFor="login-phone">
            <span className="text-sm text-mist/70">Phone (E.164)</span>
            <input
              id="login-phone"
              className="input-base"
              placeholder="+14155550123"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          {otpRequested ? (
            <label className="grid gap-2" htmlFor="login-otp-code">
              <span className="text-sm text-mist/70">OTP code</span>
              <input
                id="login-otp-code"
                className="input-base"
                placeholder="123456"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
              />
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-mist/80">
            <input type="checkbox" checked={rememberLogin} onChange={(event) => setRememberLogin(event.target.checked)} />
            Remember this login for 7 days
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {successMessage ? <p className="form-success" role="status">{successMessage}</p> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <Button type="button" fullWidth disabled={isSubmitting} onClick={() => void onRequestOtp()}>
              {isSubmitting ? 'Sending...' : 'Send OTP'}
            </Button>
            <Button type="button" fullWidth disabled={isSubmitting || !otpRequested} onClick={() => void onVerifyOtp()}>
              {isSubmitting ? 'Verifying...' : 'Verify OTP'}
            </Button>
          </div>
        </div>}

        <div className="mt-4 space-y-3">
          <Button type="button" variant="ghost" fullWidth onClick={() => void signInWithGoogle().catch(() => setError('Google sign-in is unavailable right now.'))}>
            Continue with Google
          </Button>
          <Button type="button" variant="ghost" fullWidth onClick={() => void signInWithFacebook().catch(() => setError('Facebook sign-in is unavailable right now.'))}>
            Continue with Facebook
          </Button>
          <Button type="button" variant="ghost" fullWidth onClick={() => void signInWithApple().catch(() => setError('Apple sign-in is unavailable right now.'))}>
            Continue with Apple
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
