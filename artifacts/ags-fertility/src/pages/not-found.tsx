import React from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionWrapper } from '@/components/layout/SectionWrapper';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <PageLayout>
      <SectionWrapper className="flex-1 flex items-center justify-center py-24 text-center">
        <div className="max-w-md mx-auto">
          <h1 className="text-6xl font-display font-bold text-muted-foreground/30 mb-6">404</h1>
          <h2 className="text-2xl font-display font-semibold mb-4 text-foreground">Page Not Found</h2>
          <p className="text-muted-foreground mb-8">
            We couldn't find the page you were looking for. It might have been moved or removed.
          </p>
          <Link href="/">
            <Button>Return Home</Button>
          </Link>
        </div>
      </SectionWrapper>
    </PageLayout>
  );
}
