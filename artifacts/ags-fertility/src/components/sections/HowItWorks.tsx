import React from 'react';
import { SectionWrapper, FadeIn, StaggerContainer, StaggerItem } from '../layout/SectionWrapper';

export function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Free Consultation',
      description: 'A confidential, no-pressure conversation to understand your journey, medical history, and goals.'
    },
    {
      number: '02',
      title: 'Personalized Match',
      description: 'We connect you with the right specialist and clinic in Bangalore tailored to your specific clinical needs.'
    },
    {
      number: '03',
      title: 'Treatment Planning',
      description: 'Virtual consultations with your Indian specialist to outline your protocol before you even book a flight.'
    },
    {
      number: '04',
      title: 'Travel Coordination',
      description: 'Assistance with visas, accommodation, and local transport so you can arrive in Bangalore stress-free.'
    },
    {
      number: '05',
      title: 'Treatment',
      description: 'Undergoing your procedure with our on-the-ground support team ensuring seamless communication.'
    },
    {
      number: '06',
      title: 'Return & Follow-up',
      description: 'Coordinating the handover of your medical records back to your Canadian healthcare providers.'
    }
  ];

  return (
    <SectionWrapper className="bg-white">
      <FadeIn className="text-center max-w-3xl mx-auto mb-16">
        <h2 className="text-3xl md:text-4xl font-display font-semibold mb-4">
          A Guided Journey
        </h2>
        <p className="text-lg text-muted-foreground">
          We've broken down a complex international medical journey into manageable, supported steps.
        </p>
      </FadeIn>

      <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
        {steps.map((step, idx) => (
          <StaggerItem key={idx} className="relative">
            <div className="flex flex-col">
              <span className="text-5xl font-display font-bold text-muted/50 mb-4">{step.number}</span>
              <h3 className="text-xl font-display font-semibold mb-3">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </SectionWrapper>
  );
}
