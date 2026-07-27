import React, { useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionWrapper, FadeIn, StaggerContainer, StaggerItem } from '@/components/layout/SectionWrapper';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  Globe,
  HeartHandshake,
  Plane,
  Shield,
  Headphones,
  MapPin,
  FileText,
  ArrowRight,
  Building2,
  CalendarCheck,
  Languages,
  Ambulance,
} from 'lucide-react';

const services = [
  {
    icon: MapPin,
    title: 'Clinic Selection & Credentialing',
    description:
      'We vet and match you with leading IVF hospitals and specialists in Bangalore. Every partner clinic is verified for accreditation, success rates, and ethical practices.',
  },
  {
    icon: Plane,
    title: 'Travel & Accommodation Planning',
    description:
      'From flights to local stays, we help coordinate your travel itinerary so you can focus on your treatment while we handle the logistics.',
  },
  {
    icon: FileText,
    title: 'Medical Records Translation',
    description:
      'We facilitate the secure transfer, translation, and organization of your medical records between Canadian and Indian providers so both teams stay aligned.',
  },
  {
    icon: Languages,
    title: 'Language & Cultural Support',
    description:
      'Our team bridges language and cultural gaps. We accompany you to appointments, translate medical terminology, and ensure clear communication at every step.',
  },
  {
    icon: CalendarCheck,
    title: 'Appointment Coordination',
    description:
      'We schedule and confirm all your consultations, diagnostic tests, and procedures — saving you the stress of multiple phone calls and emails.',
  },
  {
    icon: Shield,
    title: 'Legal & Ethical Guidance',
    description:
      'We provide clear, compassionate guidance on consent forms, donor agreements, and cross-border legal considerations to protect your rights.',
  },
  {
    icon: Headphones,
    title: 'Ongoing Support',
    description:
      'From your first inquiry to your return home, you will have a dedicated coordinator who knows your case personally and is just a message away.',
  },
  {
    icon: HeartHandshake,
    title: 'Post-Treatment Follow-Up',
    description:
      'Your journey does not end at the clinic door. We stay connected for follow-up care coordination, medication management, and future planning.',
  },
];

export default function ServicesPage() {
  useEffect(() => {
    document.title = 'Our Services | AGS Fertility Concierge';
  }, []);

  return (
    <PageLayout>
      <SectionWrapper className="bg-primary/5 pb-0">
        <FadeIn className="max-w-3xl">
          <p className="text-sm md:text-base font-medium text-primary tracking-widest uppercase mb-4">
            What We Offer
          </p>
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-6 text-foreground">
            Comprehensive Fertility Concierge Services
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            We handle everything beyond the medical care — so you can focus on
            what matters most: your path to parenthood.
          </p>
        </FadeIn>
      </SectionWrapper>

      <SectionWrapper>
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <StaggerItem key={service.title}>
                <div className="bg-background rounded-2xl p-8 border border-border/50 h-full flex flex-col shadow-sm hover:shadow-md transition-shadow duration-300">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                    <Icon className="w-6 h-6 text-primary" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-display font-semibold text-foreground mb-3">
                    {service.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed text-sm flex-grow">
                    {service.description}
                  </p>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerContainer>
      </SectionWrapper>

      <SectionWrapper className="bg-muted/30 text-center">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-display font-semibold text-foreground mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            Every family deserves compassionate, organized support. Let us take
            the logistical burden off your shoulders.
          </p>
          <Link href="/contact">
            <Button size="lg" className="rounded-full px-10 py-6 text-base">
              Schedule a Free Consultation <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </FadeIn>
      </SectionWrapper>
    </PageLayout>
  );
}