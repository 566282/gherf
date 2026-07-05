import { EnterpriseModulePage } from '../components/EnterpriseModulePage';
import { enterpriseModuleConfigs } from '../data/enterpriseModules';

export function SystemSettingsPage(): JSX.Element {
  return <EnterpriseModulePage config={enterpriseModuleConfigs.systemSettings} />;
}