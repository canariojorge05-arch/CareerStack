import { useCallback, useRef, useEffect } from 'react';

interface FocusTrapOptions {
  enabled: boolean;
  onEscape?: () => void;
}

export function useFocusTrap(options: FocusTrapOptions) {
  const containerRef = useRef<HTMLElement>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!options.enabled) return;

      if (event.key === 'Escape' && options.onEscape) {
        options.onEscape();
        return;
      }

      if (event.key === 'Tab' && containerRef.current) {
        const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        } else if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      }
    },
    [options]
  );

  useEffect(() => {
    if (options.enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, options.enabled]);

  return containerRef;
}

interface AriaAnnouncer {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
}

export function useAriaAnnouncer(): AriaAnnouncer {
  useEffect(() => {
    // Create aria live regions if they don't exist
    ['polite', 'assertive'].forEach((priority) => {
      const id = `aria-announce-${priority}`;
      if (!document.getElementById(id)) {
        const announcer = document.createElement('div');
        announcer.id = id;
        announcer.setAttribute('aria-live', priority);
        announcer.setAttribute('aria-atomic', 'true');
        announcer.className = 'sr-only';
        document.body.appendChild(announcer);
      }
    });

    return () => {
      ['polite', 'assertive'].forEach((priority) => {
        const id = `aria-announce-${priority}`;
        const element = document.getElementById(id);
        if (element) {
          element.remove();
        }
      });
    };
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.getElementById(`aria-announce-${priority}`);
    if (announcer) {
      announcer.textContent = '';
      // Force a reflow to ensure the announcement is made
      void announcer.offsetWidth;
      announcer.textContent = message;
    }
  }, []);

  return { announce };
}