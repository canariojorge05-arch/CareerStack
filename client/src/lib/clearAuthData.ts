// Utility to clear client-side auth/session data
export async function clearAllClientAuthData(options?: { preservePreferences?: boolean }) {
  const preservePreferences = options?.preservePreferences ?? true;

  try {
    // Clear known auth-related localStorage keys
    const authKeys = [
      'lastActiveTime',
      'authErrorHandledAt',
      'authLastRedirectAt',
      'rcp_loginAt',
      'redirectAfterLogin',
      'auth401Events',
      'lastGenericErrorAt',
      'lastAuthRedirect',
      'lastPrivateRedirect',
      // add other app-specific auth keys here if needed
    ];

    authKeys.forEach((k) => localStorage.removeItem(k));

    // Optionally clear everything in localStorage except preferences
    if (!preservePreferences) {
      localStorage.clear();
    }

    // Clear sessionStorage
    sessionStorage.clear();

    // Clear non-HttpOnly cookies
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0]?.trim();
      if (!name) return;
      // Set cookie expiry to past
      document.cookie = `${name}=;expires=${new Date(0).toUTCString()};path=/`;
    });

    // Clear caches (best-effort)
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    // Delete IndexedDB databases if possible (best-effort)
    if ('indexedDB' in window && (indexedDB as any).databases) {
      try {
        const dbs: any[] = await (indexedDB as any).databases();
        await Promise.all(dbs.map((d) => indexedDB.deleteDatabase(d.name)));
      } catch (e) {
        // ignore - not all browsers support indexedDB.databases()
      }
    }

    // Unregister service workers
    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      } catch (e) {
        // ignore non-fatal
      }
    }

    // Broadcast logout to other tabs
    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('rcp-auth');
        bc.postMessage({ type: 'logout' });
        bc.close();
      } else {
        // fallback: use localStorage event
        localStorage.setItem('rcp-logout', Date.now().toString());
        // small cleanup
        setTimeout(() => localStorage.removeItem('rcp-logout'), 1000);
      }
    } catch (e) {
      // ignore
    }

    return true;
  } catch (error) {
    console.error('Error while clearing client auth data:', error);
    return false;
  }
}
