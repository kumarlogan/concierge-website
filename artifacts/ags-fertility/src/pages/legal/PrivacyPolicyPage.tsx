import React, { useEffect } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionWrapper, FadeIn } from '@/components/layout/SectionWrapper';

export default function PrivacyPolicyPage() {
  useEffect(() => {
    document.title = 'Privacy Policy | AGS Fertility Concierge';
  }, []);

  return (
    <PageLayout>
      <SectionWrapper className="bg-primary/5 pb-0">
        <FadeIn className="max-w-3xl">
          <p className="text-sm font-medium text-primary tracking-widest uppercase mb-4">Legal</p>
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-6 text-foreground">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: July 27, 2026</p>
        </FadeIn>
      </SectionWrapper>

      <SectionWrapper>
        <FadeIn>
          <div className="max-w-3xl mx-auto prose prose-sm md:prose-base prose-foreground">
            <h2>1. Introduction</h2>
            <p>
              AGS Fertility Concierge ("we," "our," or "us") is committed to protecting
              your privacy. This Privacy Policy explains how we collect, use, disclose,
              and safeguard your information when you visit our website or use our
              concierge coordination services.
            </p>

            <h2>2. Information We Collect</h2>
            <h3>Personal Information</h3>
            <p>
              When you fill out a consultation request or contact form, we may collect:
            </p>
            <ul>
              <li>Full name</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Treatment interests or preferences</li>
              <li>Any additional information you choose to share</li>
            </ul>

            <h3>Automatically Collected Information</h3>
            <p>
              When you visit our website, we may automatically collect certain
              information including your IP address, browser type, operating system,
              referring URLs, and browsing behaviour through cookies and similar
              technologies.
            </p>

            <h2>3. How We Use Your Information</h2>
            <p>We use the information we collect for the following purposes:</p>
            <ul>
              <li>To respond to your consultation requests and inquiries</li>
              <li>To coordinate fertility treatment services with partner hospitals</li>
              <li>To improve our website and services</li>
              <li>To comply with legal and regulatory obligations</li>
              <li>To communicate with you about your journey</li>
            </ul>

            <h2>4. Legal Basis for Processing (GDPR)</h2>
            <p>
              If you are located in the European Economic Area (EEA) or United Kingdom,
              our processing of your personal data is based on the following lawful
              grounds:
            </p>
            <ul>
              <li>
                <strong>Consent:</strong> Where you have given clear consent for us to
                process your data for specific purposes
              </li>
              <li>
                <strong>Contractual Necessity:</strong> Where processing is necessary
                to fulfill our service obligations to you
              </li>
              <li>
                <strong>Legitimate Interests:</strong> Where processing is necessary for
                our legitimate business interests and does not override your rights
              </li>
            </ul>

            <h2>5. Data Sharing & Disclosure</h2>
            <p>
              We do not sell your personal information. We may share your information
              in the following circumstances:
            </p>
            <ul>
              <li>With partner hospitals and clinics as necessary for treatment coordination</li>
              <li>With service providers who assist us in operating our business</li>
              <li>When required by law or to protect legal rights</li>
              <li>With your explicit consent</li>
            </ul>

            <h2>6. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect
              your personal information against unauthorized access, alteration,
              disclosure, or destruction. However, no method of transmission over the
              Internet is 100% secure.
            </p>

            <h2>7. Data Retention</h2>
            <p>
              We retain your personal information for as long as necessary to fulfill
              the purposes described in this policy, unless a longer retention period
              is required or permitted by law.
            </p>

            <h2>8. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul>
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your data ("Right to be Forgotten")</li>
              <li>Restrict or object to processing</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
            <p>
              To exercise any of these rights, please contact us at{' '}
              <a href="mailto:privacy@agsfertility.com" className="text-primary underline">
                privacy@agsfertility.com
              </a>.
            </p>

            <h2>9. Cookies</h2>
            <p>
              Our website uses essential cookies required for functionality. With your
              consent, we also use analytics cookies to improve our website. You can
              manage your cookie preferences through our cookie consent banner. See our
              Cookie Notice for more details.
            </p>

            <h2>10. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other
              than your own, including India where our partner hospitals are located.
              We ensure appropriate safeguards are in place for such transfers.
            </p>

            <h2>11. Children's Privacy</h2>
            <p>
              Our services are not directed to individuals under the age of 18. We do
              not knowingly collect personal information from children.
            </p>

            <h2>12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you
              of any changes by posting the new policy on this page and updating the
              "Last updated" date.
            </p>

            <h2>13. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or wish to exercise your
              data protection rights, please contact us:
            </p>
            <p>
              Email:{' '}
              <a href="mailto:privacy@agsfertility.com" className="text-primary underline">
                privacy@agsfertility.com
              </a>
            </p>
          </div>
        </FadeIn>
      </SectionWrapper>
    </PageLayout>
  );
}