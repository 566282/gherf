import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { EnterpriseModulePage } from '../components/EnterpriseModulePage';
import { enterpriseModuleConfigs } from '../data/enterpriseModules';

export function AdManagementPage(): JSX.Element {
  return (
    <>
      <div className="px-6 pt-6">
        <Card className="border border-accent/30 bg-[linear-gradient(120deg,hsl(var(--chart-1)/0.14),hsl(var(--color-surface-elevated)))]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-accent/80">Live enterprise controls</p>
              <h2 className="text-2xl font-semibold text-foreground">Need launch timing, targeting, analytics, and risk review?</h2>
              <p className="max-w-3xl text-sm text-muted">
                Open the live Ad Platform workspace for operational controls, campaign moderation, reporting filters, and fraud policy review.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/admin/ad-platform"
                className="inline-flex items-center rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/40 hover:bg-accent-soft"
              >
                Open live Ad Platform
              </Link>
              <Link
                to="/admin/campaigns/new"
                className="inline-flex items-center rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-accent/40 hover:bg-accent-soft"
              >
                Create campaign
              </Link>
            </div>
          </div>
        </Card>
      </div>
      <EnterpriseModulePage config={enterpriseModuleConfigs.adManagement} />
    </>
  );
}