import React from 'react';
import { PenLine } from 'lucide-react';
import { SectionWrapper, FadeIn } from '../layout/SectionWrapper';

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white/50 rounded-3xl p-8 h-full border-2 border-dashed border-border/40 flex flex-col items-center justify-center min-h-[220px] text-center gap-3"
          >
            <PenLine className="w-6 h-6 text-muted-foreground/40" />
            <p className="text-muted-foreground/50 text-sm font-medium">
              Your story could be here
            </p>
          </div>
        ))}
      </div>
    </SectionWrapper>
  );
}
