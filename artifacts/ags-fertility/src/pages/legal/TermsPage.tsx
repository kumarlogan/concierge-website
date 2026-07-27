import React, { useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionWrapper, FadeIn } from '@/components/layout/SectionWrapper';

export default function TermsPage() {
  useEffect(() => {
    document.title = 'Terms & Conditions | AGS Fertility Concierge';
  }, []);

  return (
    <PageLayout>
      <SectionWrapper className="bg-primary/5 pb-0">
        <FadeIn className="max-w-3xl">
          <p className="text-sm font-medium text-primary tracking-widest uppercase mb-4">Legal</p>
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-6 text-foreground">
            Terms & Conditions
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: July 27, 2026</p>
        </FadeIn>
      </SectionWrapper>

      <SectionWrapper>
        <FadeIn>
          <div className="max-w-3xl mx-auto prose prose-sm md:prose-base prose-foreground">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using the AGS Fertility Concierge website and services,
              you agree to be bound by these Terms & Conditions. If you do not agree
              with any part of these terms, you should not use our website or services.
            </p>

            <h2>2. Description of Services</h2>
            <p>
              AGS Fertility Concierge ("AG Synergy") provides coordination and
              concierge services to assist intended parents in navigating fertility
              treatment options at partner hospitals in Bangalore, India. Our services
              include:
            </p>
            <ul>
              <li>Information and education about fertility treatment options</li>
              <li>Referrals and introductions to partner hospitals and specialists</li>
              <li>Coordination of appointments, travel, and logistics</li>
              <li>Translation and communication support</li>
              <li>Ongoing support throughout the treatment journey</li>
            </ul>

            <h2>3. Not Medical Advice</h2>
            <p>
              <strong>
                AGS Fertility Concierge does NOT provide medical advice, diagnosis,
                or treatment.
              </strong>
              All medical care is provided exclusively by licensed medical
              professionals at our partner hospitals. The information on our website
              is for general educational purposes only and should not be considered a
              substitute for professional medical advice. Always consult with a
              qualified healthcare provider regarding any medical condition or
              treatment.
            </p>

            <h2>4. No Guarantee of Outcomes</h2>
            <p>
              While we strive to connect you with experienced specialists and quality
              clinics, we cannot and do not guarantee any specific medical outcomes,
              including pregnancy or successful fertility treatment. Results vary
              based on individual medical circumstances.
            </p>

            <h2>5. User Responsibilities</h2>
            <p>As a user of our services, you agree to:</p>
            <ul>
              <li>Provide accurate and complete information</li>
              <li>Communicate honestly about your medical history</li>
              <li>Comply with all applicable laws and regulations</li>
              <li>Treat our team and partners with respect</li>
              <li>Not misuse our website or services</li>
            </ul>

            <h2>6. Intellectual Property</h2>
            <p>
              All content on this website, including text, graphics, logos, images,
              and software, is the property of AGS Fertility Concierge and is
              protected by applicable intellectual property laws. You may not
              reproduce, distribute, or create derivative works without our express
              written permission.
            </p>

            <h2>7. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, AGS Fertility Concierge shall
              not be liable for any indirect, incidental, special, consequential, or
              punitive damages arising out of or related to your use of our website
              or services. Our total liability for any claims shall not exceed the
              fees you have paid to us for the specific service giving rise to the
              claim.
            </p>

            <h2>8. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless AGS Fertility Concierge, its
              officers, employees, and partners from any claims, damages, losses, or
              expenses arising from your use of our services or violation of these
              terms.
            </p>

            <h2>9. Third-Party Links</h2>
            <p>
              Our website may contain links to third-party websites or services that
              are not owned or controlled by us. We have no control over and assume
              no responsibility for the content, privacy policies, or practices of
              any third-party websites.
            </p>

            <h2>10. Governing Law</h2>
            <p>
              These terms shall be governed by and construed in accordance with the
              laws of the Province of Ontario, Canada, without regard to its conflict
              of law provisions.
            </p>

            <h2>11. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Changes will
              be effective immediately upon posting. Your continued use of our website
              or services after any modifications indicates your acceptance of the
              updated terms.
            </p>

            <h2>12. Contact</h2>
            <p>
              If you have any questions about these Terms & Conditions, please
              contact us at{' '}
              <a href="mailto:legal@agsfertility.com" className="text-primary underline">
                legal@agsfertility.com
              </a>.
            </p>
          </div>
        </FadeIn>
      </SectionWrapper>
    </PageLayout>
  );
}