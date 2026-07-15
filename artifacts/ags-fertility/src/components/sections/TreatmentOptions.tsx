import React from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { SectionWrapper, FadeIn, StaggerContainer, StaggerItem } from '../layout/SectionWrapper';
import { treatments } from '@/data/treatments';

export function TreatmentOptions() {
  return (
    <SectionWrapper className="bg-muted/20 border-y border-border">
      <FadeIn className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-display font-semibold mb-4">
            Available Treatments
          </h2>
          <p className="text-lg text-muted-foreground">
            Our partner hospitals offer a comprehensive suite of advanced reproductive technologies.
          </p>
        </div>
        <Link href="/treatments" className="inline-flex items-center text-primary font-medium hover:underline">
          View all treatments <ArrowRight className="ml-2 w-4 h-4" />
        </Link>
      </FadeIn>

      <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {treatments.map((treatment) => (
          <StaggerItem key={treatment.slug}>
            <Link href={`/treatments/${treatment.slug}`}>
              <div className="block h-full p-8 rounded-2xl bg-white border border-border hover:border-primary/30 hover:shadow-md transition-all group cursor-pointer">
                <h3 className="text-xl font-display font-semibold mb-3 group-hover:text-primary transition-colors">
                  {treatment.name}
                </h3>
                <p className="text-muted-foreground line-clamp-3 mb-6">
                  {treatment.shortDescription}
                </p>
                <div className="flex items-center text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  Learn more <ArrowRight className="ml-1 w-4 h-4" />
                </div>
              </div>
            </Link>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </SectionWrapper>
  );
}
