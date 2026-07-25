import React from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import heroImg from '@assets/generated_images/hero-couple.jpg';
import { useGetConsultationCount, getGetConsultationCountQueryKey } from '@workspace/api-client-react';

export function Hero() {
  const { data: countData } = useGetConsultationCount({
    query: {
      queryKey: getGetConsultationCountQueryKey()
    }
  });

  return (
    <section className="relative min-h-[90vh] flex items-center pt-16 pb-24 overflow-hidden">
      {/* Background with slight tint */}
      <div className="absolute inset-0 z-0 bg-[#FAFAF8]" />
      
      <div className="container mx-auto px-6 md:px-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary mb-6">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
              Because Every Family's Journey Deserves Personal Care
            </div>
            
            <div className="mb-6">
              <h1 className="text-5xl md:text-6xl lg:text-7xl" style={{ fontFamily: "'Alex Brush', cursive", lineHeight: 1.15, fontWeight: 400, color: '#2a2a2a' }}>
                AGS Fertility<br />Concierge
              </h1>
            </div>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
              Trusted fertility treatment coordination for Canadian families — connecting you with experienced specialists in Bangalore, India.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link href="/contact" className="w-full sm:w-auto">
                <Button size="lg" className="w-full rounded-full text-base h-14 px-8 shadow-sm">
                  Book a Free Consultation
                </Button>
              </Link>
              <Link href="/how-it-works" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full rounded-full text-base h-14 px-8">
                  Explore Our Process
                </Button>
              </Link>
            </div>

            {countData && countData.count > 0 && (
              <div className="mt-8 pt-8 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  Join <span className="font-semibold text-foreground">{countData.count}+ families</span> who have trusted us with their journey.
                </p>
              </div>
            )}
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2, ease: "easeOut" }}
            className="relative lg:h-[600px] w-full rounded-3xl overflow-hidden shadow-2xl"
          >
            <div className="absolute inset-0 bg-primary/10 mix-blend-multiply z-10" />
            <img 
              src={heroImg} 
              alt="Hopeful couple in a clinic" 
              className="w-full h-full object-cover object-center"
              loading="eager"
            />
          </motion.div>

        </div>
      </div>
    </section>
  );
}
