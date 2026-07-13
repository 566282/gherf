import { EnterpriseModulePage } from '../components/EnterpriseModulePage';
import { enterpriseModuleConfigs } from '../data/enterpriseModules';

export function AuditLogsPage(): JSX.Element {
  return <EnterpriseModulePage config={enterpriseModuleConfigs.auditLogs} />;
}
