import React, { useEffect } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  SectionWrapper,
  FadeIn,
  StaggerContainer,
  StaggerItem,
} from '@/components/layout/SectionWrapper';

// ─── TEMPORARY birthday overlay — auto-expires July 19, 2026 ─────────────────
import BirthdayOverlay from '@/components/BirthdayOverlay';
import { Button } from '@/components/ui/button';
import {
  Heart,
  Eye,
  Shield,
  Sparkles,
  Sun,
  HandHeart,
  ArrowDown,
  MapPin,
  Search,
  HeartHandshake,
  Building2,
  Globe,
} from 'lucide-react';

// ─── Data ─────────────────────────────────────────────────────────────────────

const timelineSteps = [
  { icon: MapPin, label: 'Canada' },
  { icon: Search, label: 'Searching for answers' },
  { icon: Eye, label: 'Learning & Research' },
  { icon: HeartHandshake, label: 'Finding hope in Bangalore' },
  { icon: Heart, label: 'Life-changing experience' },
  { icon: Building2, label: 'Building this company' },
  { icon: Globe, label: 'Helping families worldwide' },
];

const missionCards = [
  {
    icon: Heart,
    title: 'Personal Experience',
    description:
      'We understand the emotional and practical challenges because we\'ve lived them ourselves.',
  },
  {
    icon: Shield,
    title: 'Trusted Connections',
    description:
      'We connect families with carefully selected fertility specialists and hospitals in Bangalore.',
  },
  {
    icon: HandHeart,
    title: 'Personal Guidance',
    description:
      'From your first conversation until you return home, we aim to make the journey simple, transparent, and supportive.',
  },
];

const values = [
  { icon: Heart, label: 'Compassion' },
  { icon: Eye, label: 'Transparency' },
  { icon: Shield, label: 'Trust' },
  { icon: Sparkles, label: 'Excellence' },
  { icon: Sun, label: 'Hope' },
  { icon: HandHeart, label: 'Personal Care' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Soft gradient particles background for the hero.
 * Pure CSS animation — no JS, no dependencies.
 */
function HeroBackground() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* Gradient blobs */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] animate-pulse" />
      <div
        className="absolute top-20 right-[-10%] w-[500px] h-[500px] rounded-full bg-accent/8 blur-[100px]"
        style={{ animation: 'float 8s ease-in-out infinite' }}
      />
      <div
        className="absolute bottom-[-20%] left-[20%] w-[400px] h-[400px] rounded-full bg-secondary/6 blur-[100px]"
        style={{ animation: 'float 10s ease-in-out infinite 2s' }}
      />

      {/* Light particles */}
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-primary/15"
          style={{
            width: `${4 + Math.random() * 8}px`,
            height: `${4 + Math.random() * 8}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `drift ${6 + Math.random() * 8}s ease-in-out infinite ${Math.random() * 4}s`,
          }}
        />
      ))}

      {/* Keyframe styles injected once */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }
        @keyframes drift {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          50% { transform: translateY(-20px) translateX(10px); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

/**
 * Horizontal journey timeline.
 */
function JourneyTimeline() {
  return (
    <div className="relative">
      {/* Connecting line */}
      <div className="absolute top-6 left-0 right-0 h-px bg-border hidden md:block" />

      <div className="flex flex-col md:flex-row items-start md:items-start justify-between gap-6 md:gap-0">
        {timelineSteps.map((step, index) => {
          const Icon = step.icon;
          return (
            <FadeIn
              key={step.label}
              delay={index * 0.08}
              className="flex flex-col items-center text-center flex-1 relative"
            >
              {/* Circle node */}
              <div className="relative z-10 w-12 h-12 rounded-full bg-background border-2 border-primary/30 flex items-center justify-center mb-3 shadow-sm">
                <Icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
              </div>
              <span className="text-xs md:text-sm font-medium text-muted-foreground max-w-[100px] leading-snug">
                {step.label}
              </span>

              {/* Down arrow between steps (mobile) */}
              {index < timelineSteps.length - 1 && (
                <ArrowDown className="w-4 h-4 text-border mt-2 md:hidden" />
              )}
            </FadeIn>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Handwritten-style signature block.
 */
function Signature() {
  return (
    <div className="mt-10 pt-8 border-t border-border/50">
      <p className="text-sm text-muted-foreground italic mb-3">With gratitude,</p>
      <p
        className="text-2xl md:text-3xl text-foreground/80 tracking-wide"
        style={{
          fontFamily: "'Dancing Script', 'Great Vibes', 'Brush Script MT', cursive",
          fontWeight: 500,
        }}
      >
        Kalpavi &amp; Kumar
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AboutPage() {
  useEffect(() => {
    document.title = 'Our Journey | AGS Fertility Concierge';
  }, []);

  return (
    <>
      {/* ─── TEMPORARY birthday overlay — auto-expires July 19, 2026 ────────── */}
      <BirthdayOverlay />

      <PageLayout>
      {/* ── 1. Hero ──────────────────────────────────────────────────────── */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        <HeroBackground />
        <div className="relative z-10 container mx-auto px-6 md:px-12 py-20 md:py-32 text-center">
          <FadeIn>
            <p className="text-sm md:text-base font-medium text-primary tracking-widest uppercase mb-6">
              Our Journey
            </p>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight text-foreground mb-6 leading-[1.1]">
              From our own journey…
              <br />
              <span className="text-primary">to helping others begin theirs.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Every family has a story. This is ours — and how it led us to dedicate
              our lives to guiding yours.
            </p>
          </FadeIn>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ArrowDown className="w-5 h-5 text-muted-foreground/50" />
        </motion.div>
      </section>

      {/* ── 2. Our Story (split layout) ──────────────────────────────────── */}
      <SectionWrapper id="our-story" className="bg-muted/30">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left — Couple portrait */}
          <FadeIn>
            <div className="relative aspect-[4/5] max-w-md mx-auto lg:max-w-none rounded-3xl overflow-hidden border border-border/50 shadow-xl bg-muted">
              <img
                src="/images/couple-portrait.jpg"
                alt="Kalpavi & Kumar — the founders of AGS Fertility Concierge"
                className="w-full h-full object-cover"
              />
              {/* Subtle frame overlay */}
              <div className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-foreground/[0.06]" />
            </div>
            <p className="text-xs text-muted-foreground/50 text-center mt-4 italic">
              Kalpavi & Kumar — Our Journey
            </p>
          </FadeIn>

          {/* Right — Story text */}
          <FadeIn delay={0.15}>
            <h2 className="text-3xl md:text-4xl font-display font-semibold text-foreground mb-8">
              Our Story
            </h2>
            <div className="space-y-5 text-muted-foreground leading-relaxed">
              <p>
                We never imagined that one day we would be helping other families
                begin their own journeys.
              </p>
              <p>
                Like many couples, we had dreams, questions, hopes, and moments of
                uncertainty.
              </p>
              <p>
                Living in Canada, we began exploring fertility treatment and
                experienced firsthand how overwhelming the process could be. Finding
                trustworthy information, understanding the options, and making
                important decisions while managing emotions wasn&rsquo;t easy.
              </p>
              <p>
                Eventually, our journey led us to India, where we discovered
                exceptional fertility specialists, compassionate care, and
                world-class medical expertise.
              </p>
              <p className="font-medium text-foreground/80">
                That experience changed our lives.
              </p>
              <p>
                It showed us that outstanding fertility treatment doesn&rsquo;t have
                to be limited by geography &mdash; it simply needs the right people
                to guide you.
              </p>
              <p className="font-medium text-foreground/80">
                Today, our mission is simple:
              </p>
              <p>To make that same journey easier for other families.</p>
              <p>
                We bridge the distance between Canada and trusted IVF specialists
                in Bangalore, helping intended parents navigate the process with
                confidence, clarity, and personal support every step of the way.
              </p>
              <p>
                Because we&rsquo;ve been on this journey ourselves, we understand
                that behind every consultation is a dream.
              </p>
              <p className="font-medium text-foreground/80">
                And every dream deserves the very best chance to become a family.
              </p>
            </div>
            <Signature />
          </FadeIn>
        </div>
      </SectionWrapper>

      {/* ── 3. Journey Timeline ──────────────────────────────────────────── */}
      <SectionWrapper id="timeline">
        <FadeIn className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-semibold text-foreground mb-4">
            The Path That Led Us Here
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Every great journey begins with a single step — and each step teaches
            us something we carry forward.
          </p>
        </FadeIn>

        <JourneyTimeline />
      </SectionWrapper>

      {/* ── 4. Why We Started (mission cards) ────────────────────────────── */}
      <SectionWrapper id="mission" className="bg-muted/30">
        <FadeIn className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-semibold text-foreground mb-4">
            Why We Started
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Three things that guide everything we do — rooted in our own
            experience.
          </p>
        </FadeIn>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {missionCards.map((card) => {
            const Icon = card.icon;
            return (
              <StaggerItem key={card.title}>
                <div className="bg-background rounded-2xl p-8 border border-border/50 h-full flex flex-col shadow-sm hover:shadow-md transition-shadow duration-300">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                    <Icon className="w-6 h-6 text-primary" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-display font-semibold text-foreground mb-3">
                    {card.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed text-sm">
                    {card.description}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </SectionWrapper>

      {/* ── 5. Values ────────────────────────────────────────────────────── */}
      <SectionWrapper id="values">
        <FadeIn className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-semibold text-foreground mb-4">
            What We Stand For
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            The principles that shape every conversation, every decision, and
            every family we serve.
          </p>
        </FadeIn>

        <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {values.map((v) => {
            const Icon = v.icon;
            return (
              <StaggerItem key={v.label}>
                <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-background border border-border/30 hover:border-primary/20 transition-colors duration-300">
                  <div className="w-14 h-14 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" strokeWidth={1.5} />
                  </div>
                  <span className="text-sm font-display font-semibold text-foreground">
                    {v.label}
                  </span>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </SectionWrapper>

      {/* ── 6. Closing ───────────────────────────────────────────────────── */}
      <SectionWrapper className="bg-muted/30 text-center">
        <FadeIn>
          <div className="max-w-3xl mx-auto">
            <blockquote className="text-3xl md:text-4xl lg:text-5xl font-display font-semibold text-foreground leading-[1.25] mb-6">
              Every family begins with hope.
            </blockquote>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed">
              If our journey can make yours a little easier, then every step we
              took was worth it.
            </p>
            <Link href="/contact">
              <Button size="lg" className="rounded-full px-10 py-6 text-base">
                Begin Your Journey With Us
              </Button>
            </Link>
          </div>
        </FadeIn>
      </SectionWrapper>
    </PageLayout>
    </>
  );
}