import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { verifyCertificate } from '@/services/api/classroom';

export function MyCertificatesPage(): JSX.Element {
  const [verificationId, setVerificationId] = useState('');

  const verifyMutation = useMutation({
    mutationFn: async () => verifyCertificate(verificationId.trim()),
  });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">My certificates</p>
        <h1 className="text-3xl font-semibold text-foreground">Certificate verification and sharing</h1>
      </header>

      <Card className="space-y-4 p-4">
        <label className="block space-y-2">
          <span className="text-sm text-muted">Verification id</span>
          <input
            type="text"
            value={verificationId}
            onChange={(event) => setVerificationId(event.target.value)}
            className="input-base w-full"
            placeholder="VERIFY-..."
          />
        </label>

        <Button onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending || !verificationId.trim()}>
          {verifyMutation.isPending ? 'Verifying...' : 'Verify certificate'}
        </Button>

        {verifyMutation.error ? <p className="text-sm text-danger">{(verifyMutation.error as Error).message}</p> : null}
        {verifyMutation.isSuccess && verifyMutation.data ? (
          <div className="rounded-2xl border border-border bg-surface-elevated p-3 text-sm text-foreground">
            <p>Certificate id: {verifyMutation.data.certificate_id}</p>
            <p>Status: {verifyMutation.data.status}</p>
            <p>Issued at: {new Date(verifyMutation.data.issued_at).toLocaleString()}</p>
            <p>
              Public verification link:{' '}
              <Link
                to={`/verify-certificate?verificationId=${encodeURIComponent(verifyMutation.data.verification_id)}`}
                className="font-medium text-accent"
              >
                Open public verifier
              </Link>
            </p>
          </div>
        ) : null}
        {verifyMutation.isSuccess && !verifyMutation.data ? <p className="text-sm text-muted">No certificate found for this verification id.</p> : null}
      </Card>
    </div>
  );
}
