import React, { useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionWrapper, FadeIn } from '@/components/layout/SectionWrapper';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function GenericShellPage({ title, description }: { title: string, description: string }) {
  useEffect(() => {
    document.title = `${title} | AGS Fertility Concierge`;
  }, [title]);

  return (
    <PageLayout>
      <SectionWrapper className="bg-muted/20 pb-0">
        <FadeIn className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">{title}</h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            {description}
          </p>
        </FadeIn>
      </SectionWrapper>

      <SectionWrapper>
        <FadeIn className="bg-white border border-border rounded-3xl p-12 text-center py-24 shadow-sm">
          <div className="w-16 h-16 bg-muted/50 rounded-full mx-auto mb-6 flex items-center justify-center">
            <span className="text-2xl">⏳</span>
          </div>
          <h2 className="text-2xl font-display font-semibold mb-4">Content Coming Soon</h2>
          <p className="text-muted-foreground max-w-lg mx-auto mb-8">
            We are currently developing detailed content for this section to provide you with the most accurate and helpful information.
          </p>
          <Link href="/contact">
            <Button>Contact us for more details</Button>
          </Link>
        </FadeIn>
      </SectionWrapper>
    </PageLayout>
  );
}
