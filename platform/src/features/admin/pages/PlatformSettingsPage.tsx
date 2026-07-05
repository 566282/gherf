import { EnterpriseModulePage } from '../components/EnterpriseModulePage';
import { enterpriseModuleConfigs } from '../data/enterpriseModules';

export function PlatformSettingsPage(): JSX.Element {
  return <EnterpriseModulePage config={enterpriseModuleConfigs.withdrawalApproval} />;
}