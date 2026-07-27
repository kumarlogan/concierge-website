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
      className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
      role="dialog"
      aria-label="Cookie consent"
      aria-describedby="cookie-consent-description"
    >
      <div className="max-w-4xl mx-auto bg-background border border-border rounded-2xl shadow-2xl p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-1">
              <Cookie className="w-5 h-5 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-lg font-display font-semibold text-foreground mb-2">
                Cookie Preferences
              </h3>
              <p id="cookie-consent-description" className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                We use essential cookies to ensure our website functions properly.
                With your consent, we also use analytics cookies to understand how
                visitors interact with our site, helping us improve your experience.
                You can choose to accept all cookies or only essential ones.
                <a
                  href="/privacy"
                  className="text-primary underline ml-1 hover:text-primary/80"
                >
                  Learn more in our Privacy Policy
                </a>
                .
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Dismiss cookie banner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-6 justify-end">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={handleEssentialOnly}
          >
            Essential Only
          </Button>
          <Button
            variant="default"
            size="sm"
            className="rounded-full"
            onClick={handleAcceptAll}
          >
            Accept All
          </Button>
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