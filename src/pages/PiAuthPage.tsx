import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import BrandLogo from "@/components/BrandLogo";

const PiAuthPage = () => {
  const [piUser, setPiUser] = useState<{ uid: string; username: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const sdkReady = typeof window !== "undefined" && !!window.Pi;
  const sandbox = String(import.meta.env.VITE_PI_SANDBOX || "true").toLowerCase() === "true";

  const initPi = () => {
    if (!window.Pi) {
      toast.error("Pi SDK not loaded");
      return false;
    }
    window.Pi.init({ version: "2.0", sandbox });
    return true;
  };

  const handlePiAuth = async () => {
    if (!initPi() || !window.Pi) return;
    setBusy(true);
    try {
      const auth = await window.Pi.authenticate(["username", "payments"], (payment) => {
        toast.info(`Incomplete payment found: ${payment.identifier}`);
      });
      setPiUser(auth.user);
      toast.success(`Authenticated as @${auth.user.username}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pi auth failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-paypal-blue to-[#072a7a] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-sm flex-col justify-center">
        <div className="mb-8 text-center">
          <BrandLogo className="mx-auto mb-4 h-16 w-16" />
          <p className="mb-1 text-lg font-semibold text-white">OpenPay</p>
          <p className="text-sm font-medium text-white/85">Welcome to OpenPay</p>
        </div>

        <div className="paypal-surface w-full rounded-3xl p-7 shadow-2xl shadow-black/15">
          <div className="mb-4">
            <h1 className="paypal-heading text-xl">Welcome</h1>
          </div>

          <div className="rounded-2xl border border-border/70 bg-white p-3">
            <h2 className="text-base font-semibold text-foreground">Sign in with Pi</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect your Pi account to continue to your wallet and payments.
            </p>
            {!sdkReady && (
              <p className="mt-1 text-xs text-destructive">
                Pi SDK is unavailable. Please open this app in Pi Browser.
              </p>
            )}
            <Button
              onClick={handlePiAuth}
              disabled={busy}
              className="mt-3 h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
            >
              Authenticate with Pi
            </Button>
            {piUser && (
              <p className="mt-3 text-sm text-foreground">
                Connected as <span className="font-semibold">@{piUser.username}</span> ({piUser.uid})
              </p>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            By continuing, you agree to our <Link to="/terms" className="text-paypal-blue font-medium">Terms</Link> and{" "}
            <Link to="/privacy" className="text-paypal-blue font-medium">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PiAuthPage;
