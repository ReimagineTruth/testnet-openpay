import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import AdminMrwainAuth from "./pages/AdminMrwainAuth";
import Dashboard from "./pages/Dashboard";
import SendMoney from "./pages/SendMoney";
import QrScannerPage from "./pages/QrScannerPage";
import TopUp from "./pages/TopUp";
import ReceivePage from "./pages/ReceivePage";
import Contacts from "./pages/Contacts";
import MenuPage from "./pages/MenuPage";
import CurrencyConverterPage from "./pages/CurrencyConverterPage";
import ActivityPage from "./pages/ActivityPage";
import RequestMoney from "./pages/RequestMoney";
import DisputesPage from "./pages/DisputesPage";
import SendInvoice from "./pages/SendInvoice";
import HelpCenter from "./pages/HelpCenter";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import AffiliatePage from "./pages/AffiliatePage";
import OpenPayGuidePage from "./pages/OpenPayGuidePage";
import PublicLedgerPage from "./pages/PublicLedgerPage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import AboutOpenPayPage from "./pages/AboutOpenPayPage";
import LegalPage from "./pages/LegalPage";
import PiAuthPage from "./pages/PiAuthPage";
import SetupProfilePage from "./pages/SetupProfilePage";
import PiAdsPage from "./pages/PiAdsPage";
import AdminDashboard from "./pages/AdminDashboard";
import MerchantOnboardingPage from "./pages/MerchantOnboardingPage";
import OpenPayOfficialPage from "./pages/OpenPayOfficialPage";
import RemittanceMerchantPage from "./pages/RemittanceMerchantPage";
import MerchantCheckoutPage from "./pages/MerchantCheckoutPage";
import OpenAppPage from "./pages/OpenAppPage";
import VirtualCardPage from "./pages/VirtualCardPage";
import NotFound from "./pages/NotFound";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import { useRealtimePushNotifications } from "./hooks/useRealtimePushNotifications";
import AppSecurityGate from "./components/AppSecurityGate";
import AppFooter from "./components/AppFooter";

const queryClient = new QueryClient();

const App = () => {
  useRealtimePushNotifications();

  return (
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<PiAuthPage />} />
              <Route path="/setup-profile" element={<SetupProfilePage />} />
              <Route path="/pi-ads" element={<PiAdsPage />} />
              <Route path="/admin-mrwain" element={<AdminMrwainAuth />} />
              <Route path="/admin-dashboard" element={<AdminDashboard />} />
              <Route path="/signin" element={<Navigate to="/admin-mrwain?mode=signin" replace />} />
              <Route path="/signup" element={<Navigate to="/admin-mrwain?mode=signup" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/send" element={<SendMoney />} />
              <Route path="/scan-qr" element={<QrScannerPage />} />
              <Route path="/topup" element={<TopUp />} />
              <Route path="/receive" element={<ReceivePage />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/currency-converter" element={<CurrencyConverterPage />} />
              <Route path="/activity" element={<ActivityPage />} />
              <Route path="/request-payment" element={<RequestMoney />} />
              <Route path="/send-invoice" element={<SendInvoice />} />
              <Route path="/disputes" element={<DisputesPage />} />
              <Route path="/help-center" element={<HelpCenter />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/affiliate" element={<AffiliatePage />} />
              <Route path="/ledger" element={<PublicLedgerPage />} />
              <Route path="/announcements" element={<AnnouncementsPage />} />
              <Route path="/openpay-guide" element={<OpenPayGuidePage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/about-openpay" element={<AboutOpenPayPage />} />
              <Route path="/legal" element={<LegalPage />} />
              <Route path="/merchant-onboarding" element={<MerchantOnboardingPage />} />
              <Route path="/merchant-checkout" element={<MerchantCheckoutPage />} />
              <Route path="/virtual-card" element={<VirtualCardPage />} />
              <Route path="/remittance-merchant" element={<RemittanceMerchantPage />} />
              <Route path="/openpay-official" element={<OpenPayOfficialPage />} />
              <Route path="/openapp" element={<OpenAppPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <AppSecurityGate />
            <AppFooter />
          </BrowserRouter>
        </TooltipProvider>
      </CurrencyProvider>
    </QueryClientProvider>
  );
};

export default App;
