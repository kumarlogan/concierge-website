import React, { useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionWrapper, FadeIn } from '@/components/layout/SectionWrapper';
import { treatments } from '@/data/treatments';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';

export default function TreatmentsPage() {
  useEffect(() => {
    document.title = "Treatments | AGS Fertility Concierge";
  }, []);

  return (
    <PageLayout>
      <SectionWrapper className="bg-muted/20 pb-0">
        <FadeIn className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">Fertility Treatments</h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Our partner hospitals offer advanced reproductive technologies. Explore the procedures that may help you on your path to parenthood.
          </p>
        </FadeIn>
      </SectionWrapper>

      <SectionWrapper>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {treatments.map((treatment, idx) => (
            <FadeIn key={treatment.slug} delay={idx * 0.1}>
              <div className="border border-border rounded-3xl p-8 h-full flex flex-col hover:shadow-md transition-shadow">
                <h2 className="text-2xl font-display font-semibold mb-4">{treatment.name}</h2>
                <p className="text-muted-foreground mb-8 flex-grow">{treatment.description}</p>
                <Link href={`/treatments/${treatment.slug}`} className="inline-flex items-center text-primary font-medium group">
                  Learn more about {treatment.name} <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>
        
        <FadeIn delay={0.4} className="mt-16 p-6 bg-muted/50 rounded-2xl text-center text-sm text-muted-foreground max-w-4xl mx-auto">
          <strong>Disclaimer:</strong> The information on this page is for general educational purposes only. Please consult a licensed fertility specialist for advice tailored to your situation. AGS Fertility Concierge does not provide medical advice.
        </FadeIn>
      </SectionWrapper>
    </PageLayout>
  );
}
