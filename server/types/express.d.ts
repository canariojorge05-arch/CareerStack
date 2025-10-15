import { UserRoleType } from '@shared/schema';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role?: UserRoleType;
      emailVerified?: boolean;
    }

    interface Request {
      user?: User;
    }
  }
}