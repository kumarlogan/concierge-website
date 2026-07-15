import React from 'react';
import { Quote } from 'lucide-react';
import { SectionWrapper, FadeIn, StaggerContainer, StaggerItem } from '../layout/SectionWrapper';
import { testimonials } from '@/data/testimonials';

export function Testimonials() {
  return (
    <SectionWrapper className="bg-primary/5">
      <FadeIn className="text-center max-w-3xl mx-auto mb-16">
        <h2 className="text-3xl md:text-4xl font-display font-semibold mb-4">
          Journeys Shared
        </h2>
        <p className="text-lg text-muted-foreground">
          Hear from Canadian families who have navigated the path to parenthood with our support.
        </p>
      </FadeIn>

      <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {testimonials.map((testimonial) => (
          <StaggerItem key={testimonial.id}>
            <div className="bg-white rounded-3xl p-8 h-full shadow-sm border border-border/50 relative">
              <Quote className="absolute top-6 right-6 w-8 h-8 text-primary/20" />
              <div className="mb-6 pt-4">
                <p className="text-muted-foreground italic leading-relaxed">
                  "{testimonial.quote}"
                </p>
              </div>
              <div className="mt-auto">
                <div className="font-semibold text-foreground">{testimonial.initials}</div>
                <div className="text-sm text-muted-foreground">{testimonial.city}, {testimonial.province}</div>
                <div className="text-xs mt-2 text-primary font-medium">{testimonial.treatmentType}</div>
              </div>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </SectionWrapper>
  );
}
