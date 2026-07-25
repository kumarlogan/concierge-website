import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Header() {
  const [location] = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
      // Always close the menu when the user scrolls
      setMobileMenuOpen(false);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  // Prevent body scroll while menu is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const navLinks = [
    { href: '/about', label: 'About Us' },
    { href: '/treatments', label: 'Treatments' },
    { href: '/partner-hospitals', label: 'Hospitals' },
    { href: '/cost-guide', label: 'Cost Guide' },
    { href: '/faq', label: 'FAQ' },
  ];

  return (
    <>
      {/* ── Fixed header bar ─────────────────────────────────────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-background/95 backdrop-blur-md shadow-sm py-4'
            : 'bg-transparent py-6'
        }`}
      >
        <div className="container mx-auto px-6 md:px-12">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-display font-semibold text-2xl tracking-tight text-foreground">
                AGS Fertility Concierge
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    location === link.href ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link href="/contact">
                <Button variant="default" className="rounded-full px-6">
                  Book Consultation
                </Button>
              </Link>
            </nav>

            {/* Hamburger — visible on mobile only */}
            <button
              className="md:hidden text-foreground p-2"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile menu overlay — sibling to header, NOT a child ─── */}
      {/*   Lives outside <header> so CSS transforms on the header   */}
      {/*   never affect this element's fixed positioning.            */}
      <div
        className={`fixed inset-0 z-40 bg-background flex flex-col pt-24 px-6 transition-transform duration-300 ease-in-out md:hidden ${
          mobileMenuOpen ? 'translate-y-0' : '-translate-y-full'
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        <nav className="flex flex-col gap-6 items-center text-center">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-2xl font-display font-medium ${
                location === link.href ? 'text-primary' : 'text-foreground'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-8 w-full">
            <Link href="/contact">
              <Button size="lg" className="w-full rounded-full">
                Book Consultation
              </Button>
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
