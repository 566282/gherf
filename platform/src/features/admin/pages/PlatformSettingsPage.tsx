import { Card } from '@/components/ui/Card';

export function PlatformSettingsPage() {
  return (
    <div className="p-6">
      <Card>
        <h1 className="text-3xl font-bold text-ember mb-4">Platform Settings</h1>
        <p className="text-mist">Configure platform-wide settings and feature flags.</p>
      </Card>
    </div>
  );
}
