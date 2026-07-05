import { EnterpriseModulePage } from '../components/EnterpriseModulePage';
import { enterpriseModuleConfigs } from '../data/enterpriseModules';

export function PermissionsPage(): JSX.Element {
  return <EnterpriseModulePage config={enterpriseModuleConfigs.permissions} />;
}