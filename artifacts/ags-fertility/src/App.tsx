import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { ScrollToTop } from '@/components/ScrollToTop';

// Pages
import HomePage from '@/pages/HomePage';
import AboutPage from '@/pages/AboutPage';
import TreatmentsPage from '@/pages/TreatmentsPage';
import TreatmentDetailPage from '@/pages/TreatmentDetailPage';
import PartnerHospitalsPage from '@/pages/PartnerHospitalsPage';
import ContactPage from '@/pages/ContactPage';
import FAQPage from '@/pages/FAQPage';
import GenericShellPage from '@/pages/GenericShellPage';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/treatments" component={TreatmentsPage} />
      <Route path="/treatments/:slug" component={TreatmentDetailPage} />
      <Route path="/partner-hospitals" component={PartnerHospitalsPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/faq" component={FAQPage} />
      
      {/* Shell Pages for Phase 1 */}
      <Route path="/ivf-bangalore">
        {() => <GenericShellPage title="IVF in Bangalore" description="Why Bangalore has become a premier destination for world-class, affordable fertility care." />}
      </Route>
      <Route path="/cost-guide">
        {() => <GenericShellPage title="Cost Guide" description="Transparent, upfront estimates on treatment, coordination, and travel costs." />}
      </Route>
      <Route path="/success-stories">
        {() => <GenericShellPage title="Success Stories" description="Read journeys from intended parents who navigated their path to parenthood with us." />}
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <ScrollToTop />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
