import React from 'react';
import { Link } from 'wouter';
import { Building2, Award } from 'lucide-react';
import { SectionWrapper, FadeIn, StaggerContainer, StaggerItem } from '../layout/SectionWrapper';
import { hospitals } from '@/data/hospitals';
import { Button } from '@/components/ui/button';

export function PartnerHospitals() {
  // Display only the first 2 for the homepage
  const featuredHospitals = hospitals.slice(0, 2);

  return (
    <SectionWrapper className="bg-white">
      <FadeIn className="text-center max-w-3xl mx-auto mb-16">
        <h2 className="text-3xl md:text-4xl font-display font-semibold mb-4">
          Trusted Partner Hospitals
        </h2>
        <p className="text-lg text-muted-foreground">
          Carefully vetted institutions that meet rigorous international standards.
        </p>
      </FadeIn>

      <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        {featuredHospitals.map((hospital) => (
          <StaggerItem key={hospital.id}>
            <div className="border border-border rounded-3xl p-8 h-full flex flex-col bg-muted/10">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-display font-semibold mb-2">{hospital.name}</h3>
                  <div className="flex items-center text-muted-foreground text-sm">
                    <Building2 className="w-4 h-4 mr-2" />
                    {hospital.location}
                  </div>
                </div>
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-border flex items-center justify-center flex-shrink-0 text-primary">
                  <Award className="w-6 h-6" />
                </div>
              </div>
              
              <p className="text-muted-foreground mb-6 flex-grow">
                {hospital.description}
              </p>

              <div className="flex flex-wrap gap-2 mb-8">
                {hospital.accreditations.map(acc => (
                  <span key={acc} className="text-xs bg-white border border-border rounded-full px-3 py-1 text-foreground font-medium">
                    {acc}
                  </span>
                ))}
              </div>

              <Link href={`/partner-hospitals`}>
                <Button variant="outline" className="w-full">View Hospital Profile</Button>
              </Link>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </SectionWrapper>
  );
}
