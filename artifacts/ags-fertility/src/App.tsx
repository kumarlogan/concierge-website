import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
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

// Workstream D — Business Activation Pages
import ServicesPage from '@/pages/marketing/ServicesPage';
import FertilityTreatmentsPage from '@/pages/marketing/FertilityTreatmentsPage';
import PricingPage from '@/pages/marketing/PricingPage';
import PrivacyPolicyPage from '@/pages/legal/PrivacyPolicyPage';
import TermsPage from '@/pages/legal/TermsPage';

// Workstream D — Cookie Consent
import { CookieConsentBanner } from '@/components/CookieConsentBanner';

// Patient Workspace (Wave 5)
import { AuthProvider } from '@/lib/auth-context';
import { AuthGuard, ClinicGuard, GuestGuard } from '@/lib/auth-guard';
import PatientLayout from '@/components/patient/PatientLayout';
import LoginPage from '@/pages/patient/LoginPage';
import RegisterPage from '@/pages/patient/RegisterPage';
import ForgotPasswordPage from '@/pages/patient/ForgotPasswordPage';
import MfaVerifyPage from '@/pages/patient/MfaVerifyPage';
import EmailVerificationPage from '@/pages/patient/EmailVerificationPage';
import ResetPasswordPage from '@/pages/patient/ResetPasswordPage';
import DashboardPage from '@/pages/patient/DashboardPage';
import ProfilePage from '@/pages/patient/ProfilePage';
import SecuritySettingsPage from '@/pages/patient/SecuritySettingsPage';
import ConsentManagementPage from '@/pages/patient/ConsentManagementPage';
import NotificationCenterPage from '@/pages/patient/NotificationCenterPage';
import JourneyTimelinePage from '@/pages/patient/JourneyTimelinePage';
import HubPage from '@/pages/patient/HubPage';
import DocumentsPage from '@/pages/patient/DocumentsPage';

// Patient Workspace (Workstream A)
import CarePlanPage from '@/pages/patient/CarePlanPage';
import TasksPage from '@/pages/patient/TasksPage';
import MilestonesPage from '@/pages/patient/MilestonesPage';
import CareCoordinationPage from '@/pages/patient/CareCoordinationPage';

// Patient Workspace (Wave 8)
import AppointmentsPage from '@/pages/patient/AppointmentsPage';
import MessagesPage from '@/pages/patient/MessagesPage';
import CommunicationPage from '@/pages/patient/CommunicationPage';

// Clinic Workspace (Workstream B)
import { ClinicLayout } from '@/pages/clinic/ClinicLayout';
import ProviderDashboardPage from '@/pages/clinic/ProviderDashboardPage';
import ClinicSchedulePage from '@/pages/clinic/ClinicSchedulePage';
import PatientSearchPage from '@/pages/clinic/PatientSearchPage';
import PatientStatusPage from '@/pages/clinic/PatientStatusPage';
import ClinicMessagesPage from '@/pages/clinic/ClinicMessagesPage';

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

      {/* Workstream D — Business Activation Pages */}
      <Route path="/services" component={ServicesPage} />
      <Route path="/fertility-treatments" component={FertilityTreatmentsPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/privacy" component={PrivacyPolicyPage} />
      <Route path="/terms" component={TermsPage} />

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

      {/* ── Patient Workspace (Wave 5) ──────────────────────── */}
      {/* Auth pages (no sidebar) */}
      <Route path="/patient/login">
        {() => (
          <GuestGuard>
            <LoginPage />
          </GuestGuard>
        )}
      </Route>
      <Route path="/patient/register">
        {() => (
          <GuestGuard>
            <RegisterPage />
          </GuestGuard>
        )}
      </Route>
      <Route path="/patient/forgot-password">
        {() => (
          <GuestGuard>
            <ForgotPasswordPage />
          </GuestGuard>
        )}
      </Route>
      {/* Email verification — reached via the link in the verification email.
          No guard: the user is not yet authenticated. The page reads ?token=
          and calls POST /identity/email/verify/complete. */}
      <Route path="/verify-email">
        {() => <EmailVerificationPage />}
      </Route>
      {/* Password reset — reached via the link in the reset email.
          No guard: the user is not yet authenticated. Reads ?token= and
          calls POST /identity/password/change. */}
      <Route path="/reset-password">
        {() => <ResetPasswordPage />}
      </Route>
      <Route path="/patient/mfa">
        {() => <MfaVerifyPage />}
      </Route>

      {/* Protected patient pages (with sidebar) */}
      <Route path="/patient/dashboard">
        {() => (
          <AuthGuard>
            <PatientLayout>
              <DashboardPage />
            </PatientLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/patient/profile">
        {() => (
          <AuthGuard>
            <PatientLayout>
              <ProfilePage />
            </PatientLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/patient/security">
        {() => (
          <AuthGuard>
            <PatientLayout>
              <SecuritySettingsPage />
            </PatientLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/patient/consents">
        {() => (
          <AuthGuard>
            <PatientLayout>
              <ConsentManagementPage />
            </PatientLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/patient/notifications">
        {() => (
          <AuthGuard>
            <PatientLayout>
              <NotificationCenterPage />
            </PatientLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/patient/timeline">
        {() => (
          <AuthGuard>
            <PatientLayout>
              <JourneyTimelinePage />
            </PatientLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/patient/hub">
        {() => (
          <AuthGuard>
            <PatientLayout>
              <HubPage />
            </PatientLayout>
          </AuthGuard>
        )}
      </Route>

      <Route path="/patient/documents">
        {() => (
          <AuthGuard>
            <PatientLayout>
              <DocumentsPage />
            </PatientLayout>
          </AuthGuard>
        )}
      </Route>

      {/* ── Patient Workspace (Workstream A) ──────────────────── */}
      <Route path="/patient/care-plan">
        {() => (
          <AuthGuard>
            <PatientLayout>
              <CarePlanPage />
            </PatientLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/patient/tasks">
        {() => (
          <AuthGuard>
            <PatientLayout>
              <TasksPage />
            </PatientLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/patient/milestones">
        {() => (
          <AuthGuard>
            <PatientLayout>
              <MilestonesPage />
            </PatientLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/patient/coordination">
        {() => (
          <AuthGuard>
            <PatientLayout>
              <CareCoordinationPage />
            </PatientLayout>
          </AuthGuard>
        )}
      </Route>

      {/* ── Patient Workspace (Wave 8) ──────────────────────── */}
      <Route path="/patient/appointments">
        {() => (
          <AuthGuard>
            <PatientLayout>
              <AppointmentsPage />
            </PatientLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/patient/messages">
        {() => (
          <AuthGuard>
            <PatientLayout>
              <MessagesPage />
            </PatientLayout>
          </AuthGuard>
        )}
      </Route>
      <Route path="/patient/communication">
        {() => (
          <AuthGuard>
            <PatientLayout>
              <CommunicationPage />
            </PatientLayout>
          </AuthGuard>
        )}
      </Route>

      {/* ── Clinic Workspace (Workstream B) ──────────────────── */}
      {/* Every clinic route is wrapped in ClinicGuard. The guard is a
          fail-closed allowlist on identity type — patients and anonymous
          visitors never reach a clinic console. */}
      <Route path="/clinic/dashboard">
        {() => (
          <ClinicGuard>
            <ClinicLayout>
              <ProviderDashboardPage />
            </ClinicLayout>
          </ClinicGuard>
        )}
      </Route>
      <Route path="/clinic/schedule">
        {() => (
          <ClinicGuard>
            <ClinicLayout>
              <ClinicSchedulePage />
            </ClinicLayout>
          </ClinicGuard>
        )}
      </Route>
      <Route path="/clinic/search">
        {() => (
          <ClinicGuard>
            <ClinicLayout>
              <PatientSearchPage />
            </ClinicLayout>
          </ClinicGuard>
        )}
      </Route>
      <Route path="/clinic/patient-status">
        {() => (
          <ClinicGuard>
            <ClinicLayout>
              <PatientStatusPage />
            </ClinicLayout>
          </ClinicGuard>
        )}
      </Route>
      <Route path="/clinic/messages">
        {() => (
          <ClinicGuard>
            <ClinicLayout>
              <ClinicMessagesPage />
            </ClinicLayout>
          </ClinicGuard>
        )}
      </Route>
      <Route path="/clinic/patients">
        {() => (
          <ClinicGuard>
            <ClinicLayout>
              <PatientSearchPage />
            </ClinicLayout>
          </ClinicGuard>
        )}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <ScrollToTop />
            <Router />
          </WouterRouter>
          <Toaster />
          <CookieConsentBanner />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
