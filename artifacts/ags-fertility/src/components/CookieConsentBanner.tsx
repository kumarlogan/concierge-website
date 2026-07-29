import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Cookie } from 'lucide-react';

const COOKIE_CONSENT_KEY = 'ags-cookie-consent';

type ConsentLevel = 'essential' | 'all' | null;

export function CookieConsentBanner() {
  const [consent, setConsent] = useState<ConsentLevel>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (stored) {
      setConsent(stored as ConsentLevel);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'all');
    setConsent('all');
    setVisible(false);
  };

  const handleEssentialOnly = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'essential');
    setConsent('essential');
    setVisible(false);
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      // pointer-events-none on container so clicks pass through to the page
      // pointer-events-auto on the inner card so buttons are interactive
      // p-1 min padding so the card still shows a gap from screen edge
      className="fixed bottom-0 left-0 right-0 z-50 p-2 pointer-events-none"
      role="dialog"
      aria-label="Cookie consent"
      aria-describedby="cookie-consent-description"
    >
      <div className="mx-auto max-w-2xl bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg px-3 py-2 pointer-events-auto">
        <div className="flex items-center gap-2">
          <Cookie className="w-4 h-4 text-primary shrink-0 hidden sm:block" strokeWidth={1.5} />
          <p id="cookie-consent-description" className="text-xs text-muted-foreground leading-snug flex-1">
            This site uses cookies to function. Analytics are optional.
            <a href="/privacy" className="text-primary underline ml-1 hover:text-primary/80 whitespace-nowrap">Learn more</a>.
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs rounded-full"
              onClick={handleEssentialOnly}
            >
              Essential Only
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-7 px-3 text-xs rounded-full"
              onClick={handleAcceptAll}
            >
              Accept All
            </Button>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground p-0.5 -mr-0.5 shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check current cookie consent level.
 * Returns 'all' | 'essential' | null.
 */
export function useCookieConsent(): ConsentLevel {
  const [level, setLevel] = useState<ConsentLevel>(null);

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    setLevel(stored as ConsentLevel);
  }, []);

  return level;
}