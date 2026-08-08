import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { verifyCertificate } from '@/services/api/classroom';

export function CertificateVerificationPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const verificationId = useMemo(() => searchParams.get('verificationId')?.trim() ?? '', [searchParams]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['classroom-public-certificate-verification', verificationId],
    queryFn: () => verifyCertificate(verificationId),
    enabled: Boolean(verificationId),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Public certificate verification</p>
        <h1 className="text-3xl font-semibold text-foreground">Verify a classroom certificate</h1>
        <p className="text-sm text-muted">Use the verification id from the certificate QR code or share link.</p>
      </header>

      <Card className="space-y-4 p-4">
        <form method="get" className="space-y-3">
          <label className="block space-y-2">
            <span className="text-sm text-muted">Verification id</span>
            <input
              type="text"
              name="verificationId"
              defaultValue={verificationId}
              className="input-base w-full"
              placeholder="VERIFY-..."
            />
          </label>
          <button type="submit" className="inline-flex rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90">
            Verify certificate
          </button>
        </form>

        {!verificationId ? <p className="text-sm text-muted">Enter a verification id to check certificate status.</p> : null}
        {isLoading ? <p className="text-sm text-muted">Loading certificate...</p> : null}
        {error ? <p className="text-sm text-danger">Unable to verify certificate.</p> : null}

        {data ? (
          <div className="space-y-2 rounded-2xl border border-border bg-surface-elevated p-4 text-sm text-foreground">
            <p><span className="text-muted">Certificate id:</span> {data.certificate_id}</p>
            <p><span className="text-muted">Status:</span> {data.status}</p>
            <p><span className="text-muted">Issued at:</span> {new Date(data.issued_at).toLocaleString()}</p>
            <p><span className="text-muted">Course id:</span> {data.course_id}</p>
          </div>
        ) : null}

        {verificationId && !isLoading && !error && !data ? (
          <p className="text-sm text-muted">No certificate found for this verification id.</p>
        ) : null}

        <p className="text-xs text-muted">
          Learners can manage their own certificates in{' '}
          <Link to="/app/classroom/certificates" className="font-medium text-accent">
            My Certificates
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}