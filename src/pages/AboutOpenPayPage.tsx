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
          OpenPay is designed as a stable payment experience. For in-app transaction context, OpenPay presents
          value as <span className="font-semibold">1 Pi = 1 USD</span>.
        </p>
        <p>
          OpenPay transactions are intended for people, merchants, and application flows that accept OpenPay.
        </p>
        <p>
          OpenPay currently connects to Pi payment infrastructure only. You cannot send funds from OpenPay directly
          to external banks or external third-party wallets at this time.
        </p>
        <p>
          OpenPay is currently free to use with no platform fee for supported core app usage.
        </p>
        <p>
          External bank and additional wallet integrations may be introduced in future releases,
          subject to technical and legal availability.
        </p>
      </div>
    </div>
  );
};

export default AboutOpenPayPage;
