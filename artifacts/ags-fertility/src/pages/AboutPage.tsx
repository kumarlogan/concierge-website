import React, { useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionWrapper, FadeIn } from '@/components/layout/SectionWrapper';

export default function AboutPage() {
  useEffect(() => {
    document.title = "About Us | AGS Fertility Concierge";
  }, []);

  return (
    <PageLayout>
      <SectionWrapper className="bg-muted/20 pb-0">
        <FadeIn className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">Our Story</h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Founded on the belief that geography should not be a barrier to growing your family. We are dedicated to connecting Canadian families with world-class fertility care in India.
          </p>
        </FadeIn>
      </SectionWrapper>

      <SectionWrapper>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          <FadeIn>
            <h2 className="text-3xl font-display font-semibold mb-6">Our Mission</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              AGS Fertility Concierge was born from a desire to provide alternatives to the often long wait times and high costs associated with fertility treatments in North America. 
            </p>
            <p className="text-muted-foreground leading-relaxed">
              We bridge the gap between Canadian intended parents and India's highly advanced reproductive medical sector. Our mission is to handle the logistics, so you can focus entirely on your physical and emotional well-being.
            </p>
          </FadeIn>
          
          <FadeIn delay={0.2} className="bg-muted/30 rounded-3xl p-8 flex flex-col justify-center border border-border">
            <h3 className="text-xl font-display font-semibold mb-4">A Note on Care</h3>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              We are coordinators and advocates, not clinicians. We do not provide medical advice. Our role is to ensure you are matched with properly vetted, highly experienced specialists who will guide your clinical journey, while we support your logistical and emotional journey.
            </p>
          </FadeIn>
        </div>
      </SectionWrapper>
    </PageLayout>
  );
}
