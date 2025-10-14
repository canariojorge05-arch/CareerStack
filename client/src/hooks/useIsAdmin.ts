import { useAuth } from './useAuth';
import { UserRole } from '@shared/schema';

export function useIsAdmin() {
  const { user } = useAuth();
  return user?.role === UserRole.ADMIN;
}