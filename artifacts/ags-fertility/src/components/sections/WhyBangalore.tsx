import React from 'react';
import { SectionWrapper, FadeIn } from '../layout/SectionWrapper';
import { Check } from 'lucide-react';
import bangaloreImg from '@assets/generated_images/bangalore-hospital.jpg';

export function WhyBangalore() {
  const points = [
    'World-class reproductive specialists and embryologists',
    'State-of-the-art accredited facilities (JCI, NABH)',
    'Shorter wait times compared to the Canadian system',
    'Significant cost savings (60–80% lower than North America)',
    'Dedicated international patient infrastructure'
  ];

  return (
    <SectionWrapper className="bg-muted/30">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <FadeIn>
          <div className="relative rounded-3xl overflow-hidden aspect-[4/3] shadow-lg">
            <img 
              src={bangaloreImg} 
              alt="Modern hospital lobby in Bangalore" 
              className="w-full h-full object-cover"
            />
          </div>
        </FadeIn>

        <FadeIn delay={0.2} className="max-w-xl">
          <h2 className="text-3xl md:text-4xl font-display font-semibold mb-6">
            World-Class Care in Bangalore, India
          </h2>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            Bangalore, India has emerged as a global hub for medical excellence, particularly in reproductive medicine. Our carefully selected partner hospitals combine advanced medical technology with profound expertise, offering a level of care that meets or exceeds international standards.
          </p>
          
          <ul className="space-y-4 mb-8">
            {points.map((point, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary" />
                </div>
                <span className="text-foreground">{point}</span>
              </li>
            ))}
          </ul>
        </FadeIn>
      </div>
    </SectionWrapper>
  );
}
