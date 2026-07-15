import React from 'react';
import { SectionWrapper, FadeIn } from '../layout/SectionWrapper';
import { ConsultationForm } from '../forms/ConsultationForm';

export function ConsultationCTA() {
  return (
    <SectionWrapper className="bg-primary/10 border-y border-primary/20" id="consultation">
      <div className="max-w-4xl mx-auto">
        <FadeIn className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-display font-semibold mb-4 text-foreground">
            Ready to Take the First Step?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Book a confidential, no-pressure consultation. We'll listen to your story, answer your questions, and explore how we can support your journey.
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="bg-white rounded-3xl p-6 md:p-10 shadow-lg border border-border">
            <ConsultationForm />
          </div>
        </FadeIn>
      </div>
    </SectionWrapper>
  );
}
