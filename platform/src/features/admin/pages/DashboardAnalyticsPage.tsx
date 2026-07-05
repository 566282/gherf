import { EnterpriseModulePage } from '../components/EnterpriseModulePage';
import { enterpriseModuleConfigs } from '../data/enterpriseModules';

export function DashboardAnalyticsPage(): JSX.Element {
  return <EnterpriseModulePage config={enterpriseModuleConfigs.dashboardAnalytics} />;
}