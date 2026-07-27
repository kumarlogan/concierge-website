import React, { useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionWrapper, FadeIn } from '@/components/layout/SectionWrapper';
import { treatments } from '@/data/treatments';
import { Link } from 'wouter';
import { ArrowRight, Stethoscope, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const categoryInfo = [
  {
    icon: Stethoscope,
    title: 'Advanced Reproductive Technologies',
    description:
      'Our partner hospitals offer state-of-the-art ART procedures including IVF, ICSI, and genetic testing — performed by experienced specialists using modern laboratory techniques.',
  },
  {
    icon: Sparkles,
    title: 'Fertility Preservation',
    description:
      'For those facing medical treatments or wishing to delay childbearing, egg freezing, sperm banking, and embryo cryopreservation provide a pathway to preserve reproductive potential.',
  },
  {
    icon: AlertCircle,
    title: 'Donor & Surrogacy Options',
    description:
      'When using one\'s own gametes is not possible, donor egg, donor sperm, donor embryo programs, and surrogacy arrangements offer alternative paths to parenthood.',
  },
];

export default function FertilityTreatmentsPage() {
  useEffect(() => {
    document.title = 'Fertility Treatments Overview | AGS Fertility Concierge';
  }, []);

  return (
    <PageLayout>
      <SectionWrapper className="bg-primary/5 pb-0">
        <FadeIn className="max-w-3xl">
          <p className="text-sm md:text-base font-medium text-primary tracking-widest uppercase mb-4">
            Understand Your Options
          </p>
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-6 text-foreground">
            Fertility Treatments — An Overview
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Fertility care is not one-size-fits-all. Learn about the different
            treatment paths available through our partner hospitals in Bangalore
            and discover what may be right for your unique situation.
          </p>
        </FadeIn>
      </SectionWrapper>

      {/* Treatment categories */}
      <SectionWrapper>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {categoryInfo.map((cat) => {
            const Icon = cat.icon;
            return (
              <FadeIn key={cat.title}>
                <div className="bg-background rounded-2xl p-6 border border-border/50 h-full shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-lg font-display font-semibold text-foreground mb-2">
                    {cat.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {cat.description}
                  </p>
                </div>
              </FadeIn>
            );
          })}
        </div>

        <h2 className="text-3xl font-display font-semibold text-foreground mb-8 text-center">
          Specific Treatments We Coordinate
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {treatments.map((treatment, idx) => (
            <FadeIn key={treatment.slug} delay={idx * 0.08}>
              <div className="border border-border rounded-3xl p-8 h-full flex flex-col hover:shadow-md transition-shadow bg-background">
                <h3 className="text-2xl font-display font-semibold mb-3 text-foreground">
                  {treatment.name}
                </h3>
                <p className="text-muted-foreground mb-6 flex-grow">
                  {treatment.shortDescription}
                </p>
                <p className="text-sm text-muted-foreground/80 mb-6 italic">
                  <strong>Who it may help:</strong> {treatment.whoItMayHelp}
                </p>
                <Link
                  href={`/treatments/${treatment.slug}`}
                  className="inline-flex items-center text-primary font-medium group"
                >
                  Learn more about {treatment.name}{' '}
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>
      </SectionWrapper>

      {/* Call to action */}
      <SectionWrapper className="bg-muted/30 text-center">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-display font-semibold text-foreground mb-4">
            Not Sure Which Treatment Is Right for You?
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            That is completely normal. Our team can help you understand the
            options and connect you with specialists who will provide a
            personalized assessment.
          </p>
          <Link href="/contact">
            <Button size="lg" className="rounded-full px-10 py-6 text-base">
              Speak With Our Team <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </FadeIn>
      </SectionWrapper>
    </PageLayout>
  );
}