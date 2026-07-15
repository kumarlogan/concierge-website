import React from 'react';
import { SectionWrapper, FadeIn } from '../layout/SectionWrapper';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqData } from '@/data/faq';

export function FAQAccordion() {
  return (
    <SectionWrapper className="bg-white">
      <div className="max-w-3xl mx-auto">
        <FadeIn className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-display font-semibold mb-4">
            Common Questions
          </h2>
          <p className="text-lg text-muted-foreground">
            Clarity is essential when planning a medical journey abroad.
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <Accordion type="single" collapsible className="w-full">
            {faqData.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-b border-border py-2">
                <AccordionTrigger className="text-left font-display text-lg font-medium hover:no-underline hover:text-primary transition-colors">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base leading-relaxed pt-2 pb-6">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </FadeIn>
      </div>
    </SectionWrapper>
  );
}
