import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  listMerchantKycRequirementsForCurrentUser,
  submitMerchantKycRequirement,
  type MerchantKycRequirement,
} from '@/services/api/p2pKyc';

function defaultPayload(requirement: MerchantKycRequirement): string {
  return JSON.stringify(
    {
      requirementKey: requirement.requirementKey,
      requirementType: requirement.requirementType,
      documentUrl: '',
      notes: '',
      metadata: {},
    },
    null,
    2,
  );
}

export function MerchantKycPage(): JSX.Element {
  const { profile } = useAuth();
  const [requirements, setRequirements] = useState<MerchantKycRequirement[]>([]);
  const [payloadByRequirement, setPayloadByRequirement] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState('Loading KYC requirements...');
  const [isSaving, setIsSaving] = useState(false);

  const refresh = async () => {
    if (!profile) return;
    const rows = await listMerchantKycRequirementsForCurrentUser(profile.id);
    setRequirements(rows);
    setPayloadByRequirement((current) => {
      const next = { ...current };
      for (const row of rows) {
        if (!next[row.id]) {
          next[row.id] = defaultPayload(row);
        }
      }
      return next;
    });
    setStatusMessage(rows.length ? 'KYC requirements loaded.' : 'No merchant KYC requirements found.');
  };

  useEffect(() => {
    void refresh().catch(() => setStatusMessage('Unable to load KYC requirements.'));
  }, [profile?.id]);

  const submit = async (requirement: MerchantKycRequirement) => {
    if (!profile) return;

    const raw = payloadByRequirement[requirement.id] ?? '{}';
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      setStatusMessage('Submission payload must be valid JSON.');
      return;
    }

    setIsSaving(true);
    setStatusMessage('Submitting KYC requirement...');

    try {
      await submitMerchantKycRequirement({
        userId: profile.id,
        requirementId: requirement.id,
        submissionPayload: payload,
      });
      await refresh();
      setStatusMessage(`${requirement.requirementKey} submitted for review.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to submit KYC requirement.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <Card className="border border-border bg-surface-elevated">
        <p className="text-sm uppercase tracking-[0.24em] text-accent/70">Merchant KYC</p>
        <h1 className="mt-2 text-3xl font-semibold text-foreground">KYC requirements</h1>
        <p className="mt-2 text-sm text-muted">
          Submit and resubmit merchant verification requirements. Approval status updates are reflected in qualification automatically.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="ghost" onClick={() => void refresh()} disabled={isSaving}>Reload</Button>
          <Link to="/app/merchant" className="rounded-full border border-border px-4 py-2 text-sm text-foreground transition hover:border-accent/40 hover:text-accent">
            Back to merchant dashboard
          </Link>
          <p className="rounded-xl border border-border bg-surface px-4 py-2 text-sm text-muted">{statusMessage}</p>
        </div>
      </Card>

      <div className="space-y-4">
        {requirements.map((requirement) => (
          <Card key={requirement.id} className="border border-border bg-surface-elevated">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{requirement.requirementKey}</h2>
                <p className="text-sm text-muted">Type: {requirement.requirementType} · Level: {requirement.levelRequired}</p>
                <p className="text-sm text-muted">Status: {requirement.status}</p>
                {requirement.rejectionReason ? <p className="mt-1 text-sm text-warning">Reason: {requirement.rejectionReason}</p> : null}
              </div>
              <Button onClick={() => void submit(requirement)} disabled={isSaving}>
                {requirement.status === 'rejected' || requirement.status === 'required' ? 'Submit / resubmit' : 'Update submission'}
              </Button>
            </div>

            <label className="mt-4 grid gap-2">
              <span className="text-sm text-muted">Submission payload JSON</span>
              <textarea
                className="input-base min-h-44 font-mono text-xs"
                value={payloadByRequirement[requirement.id] ?? '{}'}
                onChange={(event) =>
                  setPayloadByRequirement((current) => ({
                    ...current,
                    [requirement.id]: event.target.value,
                  }))
                }
              />
            </label>
          </Card>
        ))}

        {!requirements.length ? (
          <Card className="border border-border bg-surface-elevated">
            <p className="text-sm text-muted">No KYC requirements are assigned to this merchant account yet.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}