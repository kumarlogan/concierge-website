import React, { useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionWrapper, FadeIn } from '@/components/layout/SectionWrapper';
import { hospitals } from '@/data/hospitals';
import { Building2, Award, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

export default function PartnerHospitalsPage() {
  useEffect(() => {
    document.title = "Partner Hospitals | AGS Fertility Concierge";
  }, []);

  return (
    <PageLayout>
      <SectionWrapper className="bg-muted/20 pb-0">
        <FadeIn className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">Our Partner Hospitals</h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            We selectively partner with internationally accredited fertility centers in Bangalore, chosen for their clinical excellence, ethical standards, and advanced technology.
          </p>
        </FadeIn>
      </SectionWrapper>

      <SectionWrapper>
        <div className="space-y-12">
          {hospitals.map((hospital, idx) => (
            <FadeIn key={hospital.id} delay={idx * 0.1}>
              <div className="border border-border rounded-3xl p-8 lg:p-10 flex flex-col md:flex-row gap-8 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className="md:w-1/3 border-b md:border-b-0 md:border-r border-border pb-6 md:pb-0 md:pr-8 flex flex-col justify-between">
                  <div>
                    <h2 className="text-2xl font-display font-semibold mb-2">{hospital.name}</h2>
                    <div className="flex items-center text-muted-foreground text-sm mb-6">
                      <MapPin className="w-4 h-4 mr-2 text-primary" />
                      {hospital.location}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Established</div>
                    <div className="font-semibold">{hospital.established}</div>
                  </div>
                </div>
                
                <div className="md:w-2/3">
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    {hospital.description}
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                    <div>
                      <h4 className="font-semibold text-sm mb-3 flex items-center">
                        <Award className="w-4 h-4 mr-2 text-primary" /> Accreditations
                      </h4>
                      <ul className="space-y-2">
                        {hospital.accreditations.map(acc => (
                          <li key={acc} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 flex-shrink-0" />
                            {acc}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-3">Key Specialties</h4>
                      <div className="flex flex-wrap gap-2">
                        {hospital.specialties.map(spec => (
                          <span key={spec} className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md">
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <Link href="/contact">
                      <Button variant="outline">Inquire about {hospital.name}</Button>
                    </Link>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </SectionWrapper>
    </PageLayout>
  );
}
