import { EnterpriseModulePage } from '../components/EnterpriseModulePage';
import { enterpriseModuleConfigs } from '../data/enterpriseModules';

export function EmailTemplatesPage(): JSX.Element {
  return <EnterpriseModulePage config={enterpriseModuleConfigs.emailTemplates} />;
}