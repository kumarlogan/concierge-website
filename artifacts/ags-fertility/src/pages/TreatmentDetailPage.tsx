import React, { useEffect } from 'react';
import { useRoute } from 'wouter';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionWrapper, FadeIn } from '@/components/layout/SectionWrapper';
import { treatments } from '@/data/treatments';
import NotFound from './not-found';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { ArrowLeft, Check } from 'lucide-react';

export default function TreatmentDetailPage() {
  const [match, params] = useRoute('/treatments/:slug');
  const slug = params?.slug;
  
  const treatment = treatments.find(t => t.slug === slug);

  useEffect(() => {
    if (treatment) {
      document.title = `${treatment.name} | AGS Fertility Concierge`;
    }
  }, [treatment]);

  if (!match || !treatment) {
    return <NotFound />;
  }

  return (
    <PageLayout>
      <SectionWrapper className="bg-primary/5 pb-12 pt-8">
        <FadeIn>
          <Link href="/treatments" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-8 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to all treatments
          </Link>
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-6 text-foreground">{treatment.name}</h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
            {treatment.description}
          </p>
        </FadeIn>
      </SectionWrapper>

      <SectionWrapper>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          <div className="lg:col-span-2 space-y-12">
            <FadeIn>
              <h2 className="text-2xl font-display font-semibold mb-4">Who it may help</h2>
              <div className="bg-muted/30 p-6 rounded-2xl border border-border">
                <p className="text-muted-foreground leading-relaxed">
                  {treatment.whoItMayHelp}
                </p>
              </div>
            </FadeIn>

            <FadeIn>
              <h2 className="text-2xl font-display font-semibold mb-6">Typical Process</h2>
              <div className="space-y-4">
                {treatment.typicalProcess.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-4 p-4 border border-border rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="mt-1 text-foreground font-medium">{step}</div>
                  </div>
                ))}
              </div>
            </FadeIn>

            {treatment.faqs && treatment.faqs.length > 0 && (
              <FadeIn>
                <h2 className="text-2xl font-display font-semibold mb-6">Common Questions</h2>
                <div className="space-y-6">
                  {treatment.faqs.map((faq, idx) => (
                    <div key={idx}>
                      <h4 className="font-semibold text-foreground mb-2">{faq.question}</h4>
                      <p className="text-muted-foreground text-sm leading-relaxed">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </FadeIn>
            )}
          </div>

          <div>
            <FadeIn className="sticky top-32 bg-white border border-border rounded-3xl p-8 shadow-sm">
              <h3 className="text-xl font-display font-semibold mb-4">Discuss {treatment.name}</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Connect with our coordination team to see if this treatment might be right for your journey and learn about options at our partner hospitals.
              </p>
              <Link href="/contact">
                <Button className="w-full">Book Free Consultation</Button>
              </Link>
            </FadeIn>
          </div>
        </div>

        <FadeIn className="mt-16 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            <strong>Disclaimer:</strong> The information on this page is for general educational purposes only. Please consult a licensed fertility specialist for advice tailored to your situation. AGS Fertility Concierge does not provide medical advice.
          </p>
        </FadeIn>
      </SectionWrapper>
    </PageLayout>
  );
}
