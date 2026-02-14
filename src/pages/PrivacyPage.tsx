import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const PrivacyPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-10">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-paypal-dark">Privacy Policy</h1>
      </div>

      <div className="paypal-surface rounded-3xl p-5 space-y-4 text-sm text-foreground">
        <p>OpenPay collects account and transaction data required to provide wallet and payment features.</p>
        <p>We use your information to authenticate users, process payments, prevent fraud, and improve app reliability.</p>
        <p>We do not sell your personal data. Access is limited to authorized systems and service providers.</p>
        <p>You can request account-related support from Help Center and manage profile details in Settings.</p>
      </div>
    </div>
  );
};

export default PrivacyPage;
