import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";

const OPENAPP_URL = "https://www.openappdev.space/";

const OpenAppPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-10">
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate("/menu")}
          className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-paypal-dark">OpenApp Utility Apps</h1>
      </div>

      <div className="rounded-3xl border border-white/30 bg-gradient-to-br from-paypal-blue to-[#0073e6] p-5 text-white shadow-xl shadow-[#004bba]/20">
        <p className="text-sm font-semibold uppercase tracking-wide">OpenPay + OpenApp</p>
        <p className="mt-2 text-sm text-white/90">
          OpenPay users can spend balance in utility apps built in the OpenApp ecosystem. This helps merchants and users
          complete payments quickly with OpenPay checkout.
        </p>
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-5 space-y-3 text-sm text-foreground">
        <p className="font-semibold text-paypal-dark">What this means for users and merchants</p>
        <p>1. OpenPay can be used for utility-app checkout scenarios supported by OpenApp projects.</p>
        <p>2. Merchants can share checkout links and receive payments faster inside OpenPay flows.</p>
        <p>3. Users can complete payment with transparent records and simple confirmation steps.</p>

        <div className="rounded-2xl border border-border/70 bg-secondary/40 p-3">
          <p className="text-xs text-muted-foreground">Official OpenApp developer portal</p>
          <a
            href={OPENAPP_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 font-semibold text-paypal-blue"
          >
            {OPENAPP_URL}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default OpenAppPage;
