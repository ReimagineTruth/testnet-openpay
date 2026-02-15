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
        <p>
          OpenPay processes limited account and transaction information necessary to provide authentication,
          wallet balance updates, transaction history, support services, and operational security.
        </p>
        <p>
          We use this information to run the service, prevent abuse and fraud, troubleshoot issues,
          and comply with applicable legal obligations.
        </p>
        <p>
          OpenPay does not sell personal information. Access to data is restricted to authorized systems and
          service workflows required to operate the platform.
        </p>
        <p>
          OpenPay currently supports Pi-based payment flows only. OpenPay does not currently support direct
          external bank transfers or transfers to third-party external wallets.
        </p>
        <p>
          OpenPay has no platform usage fee at this time and is free to use for supported in-app operations.
          Network-side or third-party charges, if any, are outside OpenPay platform fees.
        </p>
        <p>
          For license, legal notices, and trademark statements, see the Legal page.
        </p>
      </div>
    </div>
  );
};

export default PrivacyPage;
