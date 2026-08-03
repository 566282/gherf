import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/app/providers/AuthProvider';
import { listSuspensionNotices } from '@/services/api/complianceEnforcement';

export function SuspensionNoticePage(): JSX.Element {
  const { profile } = useAuth();
  const [notices, setNotices] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    if (!profile) return;
    void listSuspensionNotices(profile.id).then(setNotices).catch(() => setNotices([]));
  }, [profile]);

  const activeNotice = notices.find((item) => String(item.notice_state) === 'active') ?? notices[0] ?? null;

  return (
    <div className="grid min-h-[70vh] place-items-center px-4 py-12">
      <Card className="w-full max-w-2xl border border-rose-500/40 bg-rose-950/20">
        <p className="text-sm uppercase tracking-[0.24em] text-rose-300">Compliance Notice</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Account restricted</h1>
        <p className="mt-3 text-mist/80">
          {activeNotice ? String(activeNotice.message ?? 'Your account is temporarily restricted by compliance policy.') : 'Your account is temporarily restricted by compliance policy.'}
        </p>

        <div className="mt-5 rounded-xl border border-rose-500/30 bg-black/30 p-4 text-sm text-mist/80">
          <p className="font-medium text-white">What you can do next</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Review failed verification or enforcement details.</li>
            <li>Submit an appeal if your case is eligible.</li>
            <li>Contact support for additional remediation steps.</li>
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/app/profile" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-mist hover:bg-white/5">Open profile</Link>
          <Link to="/app/onboarding" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-mist hover:bg-white/5">Update social/task profile</Link>
          <Link to="/help-center" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-mist hover:bg-white/5">Open help center</Link>
        </div>
      </Card>
    </div>
  );
}
