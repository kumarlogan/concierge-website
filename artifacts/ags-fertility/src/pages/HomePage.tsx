import React, { useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Hero } from '@/components/sections/Hero';
import { WhyAGS } from '@/components/sections/WhyAGS';
import { WhyBangalore } from '@/components/sections/WhyBangalore';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { TreatmentOptions } from '@/components/sections/TreatmentOptions';
import { PartnerHospitals } from '@/components/sections/PartnerHospitals';
import { Testimonials } from '@/components/sections/Testimonials';
import { FAQAccordion } from '@/components/sections/FAQAccordion';
import { ConsultationCTA } from '@/components/sections/ConsultationCTA';

export default function HomePage() {
  useEffect(() => {
    document.title = "AGS Fertility Concierge — IVF Coordination for Canadians in Bangalore";
  }, []);

  return (
    <PageLayout>
      <Hero />
      <WhyAGS />
      <WhyBangalore />
      <HowItWorks />
      <TreatmentOptions />
      <PartnerHospitals />
      <Testimonials />
      <FAQAccordion />
      <ConsultationCTA />
    </PageLayout>
  );
}
