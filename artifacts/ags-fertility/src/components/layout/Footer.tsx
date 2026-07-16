import React from 'react';
import { Link } from 'wouter';

export function Footer() {
  return (
    <footer className="bg-muted py-16 mt-24 border-t border-border">
      <div className="container mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 mb-16">
          <div className="md:col-span-1">
            <span className="font-display font-semibold text-xl tracking-tight text-foreground block mb-4">
              AGS Fertility Concierge
            </span>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              Your trusted partner in coordinating world-class fertility care in Bangalore for Canadian families.
            </p>
          </div>
          
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4">Treatments</h4>
            <ul className="space-y-3">
              <li><Link href="/treatments/ivf" className="text-sm text-muted-foreground hover:text-primary transition-colors">IVF</Link></li>
              <li><Link href="/treatments/icsi" className="text-sm text-muted-foreground hover:text-primary transition-colors">ICSI</Link></li>
              <li><Link href="/treatments/egg-freezing" className="text-sm text-muted-foreground hover:text-primary transition-colors">Egg Freezing</Link></li>
              <li><Link href="/treatments/donor-programs" className="text-sm text-muted-foreground hover:text-primary transition-colors">Donor Programs</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-display font-semibold text-foreground mb-4">Company</h4>
            <ul className="space-y-3">
              <li><Link href="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">About Us</Link></li>
              <li><Link href="/partner-hospitals" className="text-sm text-muted-foreground hover:text-primary transition-colors">Partner Hospitals</Link></li>
              <li><Link href="/cost-guide" className="text-sm text-muted-foreground hover:text-primary transition-colors">Cost Guide</Link></li>
              <li><Link href="/success-stories" className="text-sm text-muted-foreground hover:text-primary transition-colors">Success Stories</Link></li>
              <li><Link href="/faq" className="text-sm text-muted-foreground hover:text-primary transition-colors">FAQ</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-semibold text-foreground mb-4">Contact</h4>
            <ul className="space-y-3">
              <li><Link href="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">Contact Us</Link></li>
              <li><a href="mailto:care@agsfertility.com" className="text-sm text-muted-foreground hover:text-primary transition-colors">care@agsfertility.com</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground text-center md:text-left max-w-2xl">
            <strong>Disclaimer:</strong> AGS Fertility Concierge is a coordination and concierge service. We do not provide medical advice. All medical care is provided by licensed specialists at our partner hospitals. The information on this website is for general educational purposes only.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link>
          </div>
        </div>
        
        <div className="mt-8 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} AGS Fertility Concierge. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
