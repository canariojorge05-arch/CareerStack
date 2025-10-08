import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('cookieConsent');
      if (consent !== 'accepted') {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50">
      <div className="mx-auto max-w-5xl m-4 p-4 rounded-md border bg-card text-card-foreground shadow">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm">
            We use cookies to keep you logged in and to improve your experience. By clicking Accept, you agree to our cookie policy.
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              variant="default"
              onClick={() => {
                try {
                  localStorage.setItem('cookieConsent', 'accepted');
                  // Also set a simple cookie flag
                  document.cookie = `cookie_consent=1; Max-Age=${60 * 60 * 24 * 365}; Path=/`;
                } catch {}
                setVisible(false);
              }}
            >
              Accept
            </Button>
            <a className="text-sm text-blue-600 hover:underline" href="/privacy">Learn more</a>
          </div>
        </div>
      </div>
    </div>
  );
}