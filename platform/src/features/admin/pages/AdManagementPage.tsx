import { EnterpriseModulePage } from '../components/EnterpriseModulePage';
import { enterpriseModuleConfigs } from '../data/enterpriseModules';

export function AdManagementPage(): JSX.Element {
  return <EnterpriseModulePage config={enterpriseModuleConfigs.adManagement} />;
}