import { Outlet, useLocation } from 'react-router-dom';
import { PromotionalSpinPopup } from '@/components/ui/PromotionalSpinPopup';
import { resolvePromotionalSurface, type PromotionalSurface } from '@/services/api/promotionalRewards';

export function PublicLayout() {
  const location = useLocation();
  const surface = resolvePromotionalSurface(location.pathname);

  return (
    <div className="min-h-screen bg-hero text-foreground">
      <Outlet />
      {surface ? <PromotionalSpinPopup surface={surface} /> : null}
    </div>
  );
}
