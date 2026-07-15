import React, { useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionWrapper, FadeIn } from '@/components/layout/SectionWrapper';
import { FAQAccordion } from '@/components/sections/FAQAccordion';

export default function FAQPage() {
  useEffect(() => {
    document.title = "FAQ | AGS Fertility Concierge";
  }, []);

  return (
    <PageLayout>
      <SectionWrapper className="bg-muted/20 pb-0">
        <FadeIn className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">Frequently Asked Questions</h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            We understand you have many questions about seeking fertility treatment abroad. Here are answers to some of the most common concerns.
          </p>
        </FadeIn>
      </SectionWrapper>

      <FAQAccordion />
    </PageLayout>
  );
}
