import { RouterProvider } from 'react-router-dom';
import { router } from '@/app/router';

export function AppRouter(): JSX.Element {
  return <RouterProvider router={router} />;
}
