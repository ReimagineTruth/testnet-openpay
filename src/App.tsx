import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import SendMoney from "./pages/SendMoney";
import TopUp from "./pages/TopUp";
import Contacts from "./pages/Contacts";
import MenuPage from "./pages/MenuPage";
import ActivityPage from "./pages/ActivityPage";
import RequestMoney from "./pages/RequestMoney";
import SendInvoice from "./pages/SendInvoice";
import HelpCenter from "./pages/HelpCenter";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import NotFound from "./pages/NotFound";
import { CurrencyProvider } from "./contexts/CurrencyContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <CurrencyProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/send" element={<SendMoney />} />
          <Route path="/topup" element={<TopUp />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/request-money" element={<RequestMoney />} />
          <Route path="/send-invoice" element={<SendInvoice />} />
          <Route path="/help-center" element={<HelpCenter />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </CurrencyProvider>
  </QueryClientProvider>
);

export default App;
