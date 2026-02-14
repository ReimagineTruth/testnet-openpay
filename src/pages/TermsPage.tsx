import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const TermsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-10">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-paypal-dark">Terms of Service</h1>
      </div>

      <div className="paypal-surface rounded-3xl p-5 space-y-4 text-sm text-foreground">
        <p>By using OpenPay, you agree to use the app lawfully and keep your account credentials secure.</p>
        <p>You are responsible for transactions initiated from your account. Always verify recipient details before sending funds.</p>
        <p>OpenPay may suspend accounts involved in fraud, abuse, or policy violations.</p>
        <p>Features and availability may change over time. Continued use means you accept updates to these terms.</p>
      </div>
    </div>
  );
};

export default TermsPage;
