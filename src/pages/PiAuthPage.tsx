import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BrandLogo from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { getFunctionErrorMessage } from "@/lib/supabaseFunctionError";

type PiFunctionResult<T> = {
  success?: boolean;
  data?: T;
  error?: string;
};

type PiMeResponse = {
  uid: string;
  username?: string;
};

type PiAdStatusResponse = {
  identifier: string;
  mediator_ack_status: "granted" | "revoked" | "failed" | null;
  mediator_granted_at: string | null;
  mediator_revoked_at: string | null;
};

const PiAuthPage = () => {
  const [piUser, setPiUser] = useState<{ uid: string; username: string } | null>(null);
  const [piAccessToken, setPiAccessToken] = useState<string | null>(null);
  const [busyAuth, setBusyAuth] = useState(false);
  const [busyPayment, setBusyPayment] = useState(false);
  const [busyAd, setBusyAd] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("0.1");
  const [paymentMemo, setPaymentMemo] = useState("OpenPay Top Up");
  const [adsSupported, setAdsSupported] = useState<boolean | null>(null);

  const sdkReady = typeof window !== "undefined" && !!window.Pi;
  const sandbox = String(import.meta.env.VITE_PI_SANDBOX || "false").toLowerCase() === "true";

  useEffect(() => {
    const checkAppAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        toast.error("Sign in to OpenPay before connecting Pi.");
      }
    };

    checkAppAuth();
  }, []);

  const initPi = () => {
    if (!window.Pi) {
      toast.error("Pi SDK not loaded");
      return false;
    }
    window.Pi.init({ version: "2.0", sandbox });
    return true;
  };

  const invokePiPlatform = async <T,>(body: Record<string, unknown>, fallbackError: string): Promise<T> => {
    const { data, error } = await supabase.functions.invoke("pi-platform", { body });
    if (error) {
      throw new Error(await getFunctionErrorMessage(error, fallbackError));
    }

    const payload = (data ?? {}) as PiFunctionResult<T>;
    if (!payload.success) {
      throw new Error(payload.error || fallbackError);
    }

    if (!payload.data) {
      throw new Error(fallbackError);
    }

    return payload.data;
  };

  const resolveIncompletePayment = async (payment: { identifier: string; txid?: string }) => {
    try {
      if (payment.txid) {
        await invokePiPlatform(
          { action: "payment_complete", paymentId: payment.identifier, txid: payment.txid },
          "Failed to complete incomplete payment",
        );
      } else {
        await invokePiPlatform(
          { action: "payment_get", paymentId: payment.identifier },
          "Failed to read incomplete payment",
        );
      }
      toast.success(`Recovered incomplete payment: ${payment.identifier}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to recover incomplete payment");
    }
  };

  const handlePiAuth = async () => {
    if (!initPi() || !window.Pi) return;
    setBusyAuth(true);
    try {
      const auth = await window.Pi.authenticate(["username", "payments"], resolveIncompletePayment);

      const serverUser = await invokePiPlatform<PiMeResponse>(
        { action: "auth_verify", accessToken: auth.accessToken },
        "Pi auth validation failed",
      );

      if (serverUser.uid !== auth.user.uid) {
        throw new Error("Pi auth verification mismatch");
      }

      await supabase.auth.updateUser({
        data: {
          pi_uid: serverUser.uid,
          pi_username: auth.user.username,
          pi_connected_at: new Date().toISOString(),
        },
      });

      setPiUser(auth.user);
      setPiAccessToken(auth.accessToken);

      if (window.Pi.nativeFeaturesList) {
        const features = await window.Pi.nativeFeaturesList();
        setAdsSupported(features.includes("ad_network"));
      } else {
        setAdsSupported(null);
      }

      toast.success(`Authenticated as @${auth.user.username}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pi auth failed");
    } finally {
      setBusyAuth(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!initPi() || !window.Pi) return;
    if (!piAccessToken) {
      toast.error("Authenticate with Pi first");
      return;
    }

    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid Pi amount");
      return;
    }

    setBusyPayment(true);
    try {
      window.Pi.createPayment(
        {
          amount,
          memo: paymentMemo || "OpenPay payment",
          metadata: {
            source: "openpay",
            createdAt: new Date().toISOString(),
          },
        },
        {
          onReadyForServerApproval: async (paymentId: string) => {
            await invokePiPlatform(
              { action: "payment_approve", paymentId, accessToken: piAccessToken },
              "Server approval failed",
            );
          },
          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            await invokePiPlatform(
              { action: "payment_complete", paymentId, txid, accessToken: piAccessToken },
              "Server completion failed",
            );
            toast.success("Pi payment completed");
          },
          onCancel: (paymentId?: string) => {
            toast.info(paymentId ? `Payment cancelled: ${paymentId}` : "Payment cancelled");
          },
          onError: (error) => {
            const message = error instanceof Error ? error.message : error.message || "Payment failed";
            toast.error(message);
          },
        },
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start payment");
    } finally {
      setBusyPayment(false);
    }
  };

  const handleShowInterstitialAd = async () => {
    if (!initPi() || !window.Pi?.Ads?.showAd) return;

    setBusyAd(true);
    try {
      const readyResult = await window.Pi.Ads.isAdReady?.("interstitial");
      if (readyResult && !readyResult.ready) {
        await window.Pi.Ads.requestAd?.("interstitial");
      }

      const showResult = await window.Pi.Ads.showAd("interstitial");
      toast.info(`Interstitial result: ${showResult.result}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Interstitial ad failed");
    } finally {
      setBusyAd(false);
    }
  };

  const handleShowRewardedAd = async () => {
    if (!initPi() || !window.Pi?.Ads?.showAd) return;
    if (!piUser) {
      toast.error("Authenticate with Pi first");
      return;
    }

    setBusyAd(true);
    try {
      const readyResult = await window.Pi.Ads.isAdReady?.("rewarded");
      if (readyResult && !readyResult.ready) {
        const requestResult = await window.Pi.Ads.requestAd?.("rewarded");
        if (!requestResult || requestResult.result !== "AD_LOADED") {
          toast.error(`Rewarded ad unavailable: ${requestResult?.result || "unknown"}`);
          return;
        }
      }

      const showResult = await window.Pi.Ads.showAd("rewarded");
      if (showResult.result !== "AD_REWARDED") {
        toast.info(`Rewarded ad ended with: ${showResult.result}`);
        return;
      }

      if (!showResult.adId) {
        toast.error("Rewarded ad returned no adId; reward not granted");
        return;
      }

      const adStatus = await invokePiPlatform<PiAdStatusResponse>(
        { action: "ad_verify", adId: showResult.adId },
        "Rewarded ad verification failed",
      );

      if (adStatus.mediator_ack_status === "granted") {
        toast.success("Rewarded ad verified and granted");
      } else {
        toast.error(`Rewarded ad not granted (${adStatus.mediator_ack_status ?? "unknown"})`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rewarded ad flow failed");
    } finally {
      setBusyAd(false);
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
              disabled={busyAuth}
              className="mt-3 h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
            >
              {busyAuth ? "Authenticating..." : "Authenticate with Pi"}
            </Button>
            {piUser && (
              <p className="mt-3 text-sm text-foreground">
                Connected as <span className="font-semibold">@{piUser.username}</span> ({piUser.uid})
              </p>
            )}
            {adsSupported === false && (
              <p className="mt-2 text-xs text-destructive">
                Ad Network not supported on current Pi Browser build.
              </p>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-border/70 bg-white p-3">
            <h2 className="text-base font-semibold text-foreground">Pi Payment (U2A)</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tests `createPayment` with server approval and completion callbacks.
            </p>
            <div className="mt-3 space-y-2">
              <Input
                type="number"
                min="0.000001"
                step="0.000001"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Amount in Pi"
              />
              <Input
                type="text"
                value={paymentMemo}
                onChange={(e) => setPaymentMemo(e.target.value)}
                placeholder="Payment memo"
              />
            </div>
            <Button
              onClick={handleCreatePayment}
              disabled={busyPayment || !piUser}
              className="mt-3 h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
            >
              {busyPayment ? "Starting Payment..." : "Start Pi Payment"}
            </Button>
          </div>

          <div className="mt-4 rounded-2xl border border-border/70 bg-white p-3">
            <h2 className="text-base font-semibold text-foreground">Pi Ad Network</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Interstitial and rewarded ad flow with server-side rewarded verification.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <Button
                onClick={handleShowInterstitialAd}
                disabled={busyAd}
                variant="outline"
                className="h-11 w-full rounded-2xl"
              >
                Show Interstitial Ad
              </Button>
              <Button
                onClick={handleShowRewardedAd}
                disabled={busyAd || !piUser}
                className="h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
              >
                Show Rewarded Ad
              </Button>
            </div>
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
