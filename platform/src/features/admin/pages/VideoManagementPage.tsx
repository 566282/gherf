import { EnterpriseModulePage } from '../components/EnterpriseModulePage';
import { enterpriseModuleConfigs } from '../data/enterpriseModules';

export function VideoManagementPage(): JSX.Element {
  return <EnterpriseModulePage config={enterpriseModuleConfigs.videoManagement} />;
}