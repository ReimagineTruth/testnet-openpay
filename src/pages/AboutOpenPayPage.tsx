import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const AboutOpenPayPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-10">
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-paypal-dark">About OpenPay</h1>
      </div>

      <div className="paypal-surface rounded-3xl p-5 space-y-4 text-sm text-foreground">
        <p>
          OpenPay is designed as a stable payment experience where values inside the app are treated as
          <span className="font-semibold"> 1 Pi = 1 USD</span> for in-app transaction use.
        </p>
        <p>
          OpenPay transactions are currently intended for people and merchants that use OpenPay, plus apps and flows
          that accept OpenPay.
        </p>
        <p>
          Right now, OpenPay is connected to Pi payments only. You cannot send funds directly to external banks or
          to other external wallets from OpenPay at this time.
        </p>
        <p>
          External bank and wallet integrations may be added in future releases when supported and compliant.
        </p>
      </div>
    </div>
  );
};

export default AboutOpenPayPage;

