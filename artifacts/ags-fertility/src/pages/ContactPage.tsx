import React, { useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionWrapper, FadeIn } from '@/components/layout/SectionWrapper';
import { ConsultationForm } from '@/components/forms/ConsultationForm';

export default function ContactPage() {
  useEffect(() => {
    document.title = "Contact Us | AGS Fertility Concierge";
  }, []);

  return (
    <PageLayout>
      <SectionWrapper className="bg-primary/5 pb-12 pt-8">
        <FadeIn className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-6 text-foreground">
            Let's Talk
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Reach out for a free, confidential consultation. We are here to listen and help you understand your options for fertility care in Bangalore.
          </p>
        </FadeIn>
      </SectionWrapper>

      <SectionWrapper>
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <div className="bg-white rounded-3xl p-6 md:p-10 shadow-lg border border-border">
              <ConsultationForm />
            </div>
          </FadeIn>
        </div>
      </SectionWrapper>
    </PageLayout>
  );
}
