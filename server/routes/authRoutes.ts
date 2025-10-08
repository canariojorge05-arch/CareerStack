import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { isAuthenticated as isSessionAuthenticated } from '../localAuth';

const router = Router();

// Public routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/verify-2fa', AuthController.verify2FACode);
router.post('/request-password-reset', AuthController.requestPasswordReset);
router.post('/forgot-password', AuthController.requestPasswordReset); // Alias for frontend compatibility
router.post('/reset-password', AuthController.resetPassword);
router.post('/resend-verification', AuthController.resendVerification);

// Protected routes (session-based)
router.get('/me', isSessionAuthenticated as any, AuthController.getCurrentUser);
router.get('/user', isSessionAuthenticated as any, AuthController.getCurrentUser);
router.post('/logout', isSessionAuthenticated as any, AuthController.logout);
router.get('/devices', isSessionAuthenticated as any, AuthController.getUserDevices);
router.delete('/devices/:deviceId', isSessionAuthenticated as any, AuthController.revokeDevice);

export default router;
