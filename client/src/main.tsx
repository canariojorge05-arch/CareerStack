import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { logStartupInfo } from './lib/debug';
import { clearAllClientAuthData } from './lib/clearAuthData';

// Register service worker only in production to avoid dev issues
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    if (import.meta.env.PROD) {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
        });

        if (registration.installing) {
          console.log('Service worker installing');
        } else if (registration.waiting) {
          console.log('Service worker installed');
        } else if (registration.active) {
          console.log('Service worker active');
        }
      } catch (error) {
        // Silently handle service worker registration errors in production
        // to prevent them from affecting the user experience
        console.warn('Service worker registration failed (non-critical):', error);
      }
    } else {
      // In development, unregister any existing service workers
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          console.log('Unregistered service worker for development');
        }
      } catch (error) {
        console.warn('Failed to unregister service workers:', error);
      }
    }
  }
}

// Register SW when the app loads
window.addEventListener('load', registerServiceWorker);

// Log startup info for debugging
logStartupInfo();

createRoot(document.getElementById('root')!).render(<App />);

// Cross-tab logout listener
if ('BroadcastChannel' in window) {
  const bc = new BroadcastChannel('rcp-auth');
  bc.addEventListener('message', (ev) => {
    try {
      if (ev.data?.type === 'logout') {
        clearAllClientAuthData({ preservePreferences: true }).then(() => {
          // ensure user sees logged-out UI
          window.location.replace('/');
        });
      }
    } catch (e) {
      console.error('Error handling broadcast logout:', e);
    }
  });
}

// Fallback storage event listener
window.addEventListener('storage', (ev) => {
  if (ev.key === 'rcp-logout') {
    clearAllClientAuthData({ preservePreferences: true }).then(() => {
      window.location.replace('/');
    });
  }
});

// Auto-logout after 24 hours from login (client-side enforcement)
try {
  const LOGIN_TTL = 24 * 60 * 60 * 1000; // 24 hours
  const loginAt =
    parseInt(
      localStorage.getItem('rcp_loginAt') || localStorage.getItem('lastActiveTime') || '0',
      10
    ) || 0;
  const now = Date.now();
  if (loginAt > 0) {
    const elapsed = now - loginAt;
    if (elapsed >= LOGIN_TTL) {
      // expired - perform cleanup immediately
      clearAllClientAuthData({ preservePreferences: true }).then(() =>
        window.location.replace('/')
      );
    } else {
      // schedule remaining time
      setTimeout(() => {
        clearAllClientAuthData({ preservePreferences: true }).then(() =>
          window.location.replace('/')
        );
      }, LOGIN_TTL - elapsed);
    }
  }
} catch (e) {
  console.error('Auto-logout initialization error:', e);
}
