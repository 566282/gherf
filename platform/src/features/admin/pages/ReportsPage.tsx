import { EnterpriseModulePage } from '../components/EnterpriseModulePage';
import { enterpriseModuleConfigs } from '../data/enterpriseModules';

export function ReportsPage(): JSX.Element {
  return <EnterpriseModulePage config={enterpriseModuleConfigs.reports} />;
}