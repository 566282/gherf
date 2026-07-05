import { EnterpriseModulePage } from '../components/EnterpriseModulePage';
import { enterpriseModuleConfigs } from '../data/enterpriseModules';

export function RewardSettingsPage(): JSX.Element {
  return <EnterpriseModulePage config={enterpriseModuleConfigs.rewardSettings} />;
}