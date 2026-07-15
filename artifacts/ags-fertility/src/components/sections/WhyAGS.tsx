import React from 'react';
import { ShieldCheck, HeartHandshake, FileText, Stethoscope } from 'lucide-react';
import { SectionWrapper, FadeIn, StaggerContainer, StaggerItem } from '../layout/SectionWrapper';

export function WhyAGS() {
  const pillars = [
    {
      icon: <ShieldCheck className="w-6 h-6 text-primary" />,
      title: 'Verified Hospitals',
      description: 'We partner exclusively with accredited, internationally recognized clinics in Bangalore with proven track records.'
    },
    {
      icon: <HeartHandshake className="w-6 h-6 text-primary" />,
      title: 'End-to-End Coordination',
      description: 'From your first virtual consult to your return to Canada, we handle the logistics so you can focus on your care.'
    },
    {
      icon: <FileText className="w-6 h-6 text-primary" />,
      title: 'Transparent Pricing',
      description: 'Clear, upfront cost structures with no hidden fees, helping you plan your journey with confidence.'
    },
    {
      icon: <Stethoscope className="w-6 h-6 text-primary" />,
      title: 'Ongoing Support',
      description: 'Continuous emotional and logistical support, bridging the gap between your local and international medical teams.'
    }
  ];

  return (
    <SectionWrapper className="bg-white">
      <FadeIn className="text-center max-w-3xl mx-auto mb-16">
        <h2 className="text-3xl md:text-4xl font-display font-semibold mb-4">
          Why Choose AGS Fertility Concierge?
        </h2>
        <p className="text-lg text-muted-foreground">
          We bring clarity and calm to an overwhelming process, ensuring you receive world-class care without the logistical stress.
        </p>
      </FadeIn>

      <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {pillars.map((pillar, idx) => (
          <StaggerItem key={idx}>
            <div className="bg-background rounded-2xl p-8 h-full border border-border/50 hover:shadow-md transition-shadow duration-300">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                {pillar.icon}
              </div>
              <h3 className="text-xl font-display font-semibold mb-3">{pillar.title}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {pillar.description}
              </p>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </SectionWrapper>
  );
}
