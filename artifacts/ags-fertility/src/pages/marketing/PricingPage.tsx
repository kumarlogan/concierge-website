import React, { useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionWrapper, FadeIn } from '@/components/layout/SectionWrapper';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  Shield,
  Info,
  CheckCircle,
  ArrowRight,
  Plane,
  Home,
  FileText,
  HeartPulse,
} from 'lucide-react';

const costFactors = [
  {
    icon: HeartPulse,
    title: 'Treatment Type',
    items: [
      'IVF cycle costs vary by protocol complexity',
      'ICSI adds a surcharge for micromanipulation',
      'Donor gamete programs include screening and compensation',
      'Fertility preservation (egg/sperm/embryo freezing)',
    ],
  },
  {
    icon: Home,
    title: 'Accommodation & Stay',
    items: [
      'Duration typically 2–4 weeks per cycle',
      'Short-term rentals near partner hospitals',
      'Hotel options for shorter diagnostic visits',
      'Meal and local transport costs',
    ],
  },
  {
    icon: Plane,
    title: 'Travel',
    items: [
      'Round-trip flights from Canada to Bangalore',
      'Domestic connections if applicable',
      'Travel insurance for medical trips',
      'Visa application fees for medical travel',
    ],
  },
  {
    icon: FileText,
    title: 'Coordination & Support',
    items: [
      'Concierge coordination fee (one-time)',
      'Medical records translation if needed',
      'Appointment scheduling and liaison',
      'Ongoing remote follow-up support',
    ],
  },
];

const pricingTiers = [
  {
    name: 'Discovery',
    price: 'Free',
    description: 'Initial consultation to understand your needs and explain the process.',
    features: [
      '30-minute video call with our team',
      'Overview of treatment options',
      'High-level cost estimate',
      'No commitment required',
    ],
    highlighted: false,
  },
  {
    name: 'Essential Coordination',
    price: 'Custom Quote',
    description: 'End-to-end coordination for your fertility journey.',
    features: [
      'Dedicated personal coordinator',
      'Clinic matching & credential verification',
      'Appointment scheduling across all visits',
      'Medical records coordination',
      'Travel & accommodation assistance',
      'Ongoing support throughout treatment',
    ],
    highlighted: true,
  },
  {
    name: 'Premium Concierge',
    price: 'Custom Quote',
    description: 'White-glove support with enhanced services for a seamless experience.',
    features: [
      'Everything in Essential Coordination',
      'In-person accompaniment to appointments',
      'Priority scheduling',
      'Legal & donor coordination support',
      'Post-treatment follow-up care plan',
      'Return travel coordination',
    ],
    highlighted: false,
  },
];

export default function PricingPage() {
  useEffect(() => {
    document.title = 'Pricing & Costs | AGS Fertility Concierge';
  }, []);

  return (
    <PageLayout>
      <SectionWrapper className="bg-primary/5 pb-0">
        <FadeIn className="max-w-3xl">
          <p className="text-sm md:text-base font-medium text-primary tracking-widest uppercase mb-4">
            Transparent Pricing
          </p>
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-6 text-foreground">
            Understanding the Costs
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            We believe in full transparency. Here is a breakdown of the typical
            costs involved in pursuing fertility treatment in Bangalore through
            our concierge service.
          </p>
        </FadeIn>
      </SectionWrapper>

      {/* Cost factors */}
      <SectionWrapper>
        <FadeIn className="text-center mb-12">
          <h2 className="text-3xl font-display font-semibold text-foreground mb-4">
            What Factors Affect the Total Cost?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Every journey is unique. The total investment depends on your
            specific treatment plan, duration of stay, and level of support needed.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {costFactors.map((factor) => {
            const Icon = factor.icon;
            return (
              <FadeIn key={factor.title}>
                <div className="bg-background rounded-2xl p-6 border border-border/50 h-full shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-xl font-display font-semibold text-foreground">
                      {factor.title}
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {factor.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </SectionWrapper>

      {/* Pricing tiers */}
      <SectionWrapper className="bg-muted/30">
        <FadeIn className="text-center mb-12">
          <h2 className="text-3xl font-display font-semibold text-foreground mb-4">
            Our Service Packages
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Choose the level of support that fits your needs. All packages
            include our commitment to compassionate, transparent care.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {pricingTiers.map((tier) => (
            <FadeIn key={tier.name}>
              <div
                className={`rounded-3xl p-8 h-full flex flex-col border-2 shadow-sm ${
                  tier.highlighted
                    ? 'border-primary bg-primary/5 shadow-lg'
                    : 'border-border bg-background'
                }`}
              >
                {tier.highlighted && (
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">
                    Most Popular
                  </span>
                )}
                <h3 className="text-2xl font-display font-semibold text-foreground mb-1">
                  {tier.name}
                </h3>
                <p className="text-3xl font-bold text-primary mb-4">{tier.price}</p>
                <p className="text-sm text-muted-foreground mb-6">{tier.description}</p>
                <ul className="space-y-3 mb-8 flex-grow">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground/80">
                      <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/contact">
                  <Button
                    variant={tier.highlighted ? 'default' : 'outline'}
                    className="w-full rounded-full"
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>
      </SectionWrapper>

      {/* Important note */}
      <SectionWrapper>
        <FadeIn>
          <div className="max-w-3xl mx-auto p-6 bg-amber-50 border border-amber-200 rounded-2xl">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-800 mb-2">Important Note on Medical Costs</h3>
                <p className="text-sm text-amber-700 leading-relaxed">
                  Medical treatment costs (clinic fees, medications, laboratory
                  work) are billed directly by the partner hospital or provider.
                  Our concierge fees are separate and cover coordination,
                  support, and logistics services only. We provide transparent
                  cost estimates but do not control hospital pricing, which may
                  vary based on your specific medical protocol. We recommend
                  obtaining a personalized treatment plan and cost estimate from
                  your chosen clinic before making travel arrangements.
                </p>
              </div>
            </div>
          </div>
        </FadeIn>
      </SectionWrapper>

      <SectionWrapper className="bg-muted/30 text-center">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-display font-semibold text-foreground mb-4">
            Get a Personalized Estimate
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            The best way to understand what your journey will cost is to speak
            with us directly. We will walk through your specific needs and
            provide a clear, itemized estimate.
          </p>
          <Link href="/contact">
            <Button size="lg" className="rounded-full px-10 py-6 text-base">
              Request a Free Consultation <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </FadeIn>
      </SectionWrapper>
    </PageLayout>
  );
}