import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, HelpCircle, ImageIcon } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import BrandLogo from "@/components/BrandLogo";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const extractQrPayload = (rawValue: string) => {
  const value = rawValue.trim();
  if (!value) return { uid: null as string | null, username: "", amount: "", currency: "", note: "" };

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(value)) return { uid: value, username: "", amount: "", currency: "", note: "" };

  const normalizeUsername = (input: string | null | undefined) =>
    (input || "").trim().replace(/^@+/, "").toLowerCase();

  try {
    const parsed = new URL(value);
    const uidOrTo = parsed.searchParams.get("uid") || parsed.searchParams.get("to");
    const usernameParam = parsed.searchParams.get("username");
    const pathUsername =
      parsed.hostname === "pay"
        ? normalizeUsername(parsed.pathname.replace(/^\/+/, ""))
        : "";
    const normalizedUsername = normalizeUsername(usernameParam) || pathUsername;
    const amount = parsed.searchParams.get("amount") || "";
    const currencyCode = (parsed.searchParams.get("currency") || "").toUpperCase();
    const note = parsed.searchParams.get("note") || "";
    return {
      uid: uidOrTo && uuidRegex.test(uidOrTo) ? uidOrTo : null,
      username: normalizedUsername,
      amount,
      currency: currencyCode,
      note,
    };
  } catch {
    // no-op
  }

  const maybeUid = value.split("uid=")[1]?.split("&")[0] || value.split("to=")[1]?.split("&")[0];
  const maybeUsername = normalizeUsername(value.split("username=")[1]?.split("&")[0]);
  const maybeAmount = value.split("amount=")[1]?.split("&")[0] || "";
  const maybeCurrency = (value.split("currency=")[1]?.split("&")[0] || "").toUpperCase();
  const maybeNote = value.split("note=")[1]?.split("&")[0] || "";
  return {
    uid: maybeUid && uuidRegex.test(maybeUid) ? maybeUid : null,
    username: maybeUsername,
    amount: maybeAmount,
    currency: maybeCurrency,
    note: maybeNote,
  };
};

const QrScannerPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [scanError, setScanError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [pastedCode, setPastedCode] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handlingDecodeRef = useRef(false);

  const returnTo = useMemo(() => {
    const requested = searchParams.get("returnTo") || "/send";
    return requested.startsWith("/") ? requested : "/send";
  }, [searchParams]);

  const stopScanner = async () => {
    if (!scannerRef.current) return;
    try {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
    } catch {
      // no-op
    }
    try {
      scannerRef.current.clear();
    } catch {
      // no-op
    }
  };

  const patchVideoElementForMobile = () => {
    if (typeof document === "undefined") return;
    const video = document.querySelector("#openpay-full-scanner video") as HTMLVideoElement | null;
    if (!video) return;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.setAttribute("autoplay", "true");
    video.setAttribute("muted", "true");
  };

  const handleDecoded = async (decodedText: string) => {
    if (handlingDecodeRef.current) return;
    handlingDecodeRef.current = true;

    const payload = extractQrPayload(decodedText);
    await stopScanner();
    let recipientId = payload.uid;
    if (!recipientId && payload.username) {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", payload.username)
        .limit(1)
        .maybeSingle();
      recipientId = data?.id || null;
    }

    if (!recipientId) {
      toast.error("Invalid QR code");
      handlingDecodeRef.current = false;
      return;
    }

    const params = new URLSearchParams({ to: recipientId });
    if (payload.amount && Number.isFinite(Number(payload.amount)) && Number(payload.amount) > 0) {
      params.set("amount", Number(payload.amount).toFixed(2));
    }
    if (payload.currency) {
      params.set("currency", payload.currency);
    }
    if (payload.note) {
      params.set("note", payload.note);
    }

    navigate(`${returnTo}?${params.toString()}`, { replace: true });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "openpay_scan_instructions_ack_v1";
    const seen = localStorage.getItem(key) === "1";
    if (!seen) setShowInstructions(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    handlingDecodeRef.current = false;

    const waitForScannerElement = async () => {
      if (typeof document === "undefined") return false;
      for (let i = 0; i < 12; i += 1) {
        if (document.getElementById("openpay-full-scanner")) return true;
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return false;
    };

    const startScanner = async () => {
      await stopScanner();
      const hasScannerElement = await waitForScannerElement();
      if (!hasScannerElement) {
        if (mounted) setScanError("Scanner failed to mount. Please retry.");
        return;
      }
      if (typeof window !== "undefined" && !window.isSecureContext) {
        if (mounted) setScanError("Camera requires HTTPS (or localhost).");
        return;
      }
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        if (mounted) setScanError("Camera is not available on this device/browser.");
        return;
      }

      const scanner = new Html5Qrcode("openpay-full-scanner", {
        useBarCodeDetectorIfSupported: false,
      });
      scannerRef.current = scanner;

      try {
        let cameras: Awaited<ReturnType<typeof Html5Qrcode.getCameras>> = [];
        try {
          cameras = await Html5Qrcode.getCameras();
        } catch {
          // Some browsers block camera enumeration until stream opens. Keep fallback sources.
        }
        const preferredBack = cameras.find((cam) => /(back|rear|environment)/i.test(cam.label || ""));
        const sources: Array<string | MediaTrackConstraints> = [];
        sources.push({ facingMode: { exact: "environment" } });
        sources.push({ facingMode: { ideal: "environment" } });
        sources.push({ facingMode: "environment" });
        if (preferredBack?.id) sources.push(preferredBack.id);
        if (cameras[0]?.id) sources.push(cameras[0].id);
        sources.push({ facingMode: "user" });

        const scanConfig = {
          fps: 12,
          disableFlip: false,
        };

        let started = false;
        let startError = "";
        for (const source of sources) {
          try {
            await scanner.start(source, scanConfig, (decodedText) => {
              void handleDecoded(decodedText);
            }, () => undefined);
            patchVideoElementForMobile();
            started = true;
            if (mounted) {
              setScanError("");
              setScanning(true);
            }
            break;
          } catch (error) {
            startError = error instanceof Error ? error.message : "Unable to open camera";
          }
        }

        if (!started && mounted) setScanError(startError || "Unable to open camera");
      } catch (error) {
        if (mounted) setScanError(error instanceof Error ? error.message : "Unable to open camera");
      }
    };

    void startScanner();

    return () => {
      mounted = false;
      void stopScanner();
      scannerRef.current = null;
    };
  }, [returnTo]);

  const handleSelectFile = async (file: File) => {
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("openpay-full-scanner");
      }
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
      const decoded = await scannerRef.current.scanFile(file, true);
      await handleDecoded(decoded);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to read QR from image");
    }
  };

  const handleUsePastedCode = async () => {
    if (!pastedCode.trim()) {
      toast.error("Paste an OpenPay QR code/link first");
      return;
    }
    await handleDecoded(pastedCode.trim());
  };

  const handleAcknowledgeInstructions = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("openpay_scan_instructions_ack_v1", "1");
    }
    setShowInstructions(false);
  };

  return (
    <div className="fixed inset-0 h-[100dvh] w-screen bg-black text-white">
      <div className="relative h-full w-full overflow-hidden">
        <style>{`
          #openpay-full-scanner {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100dvh !important;
            overflow: hidden !important;
            background: #000 !important;
          }
          #openpay-full-scanner > div {
            position: absolute !important;
            inset: 0 !important;
          }
          #openpay-full-scanner video {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100dvh !important;
            object-fit: cover !important;
            transform: translateZ(0);
            background: #000 !important;
          }
          #openpay-full-scanner__scan_region {
            position: absolute !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100dvh !important;
            min-height: 100dvh !important;
            margin: 0 !important;
            border: 0 !important;
            background: transparent !important;
          }
          #openpay-full-scanner__scan_region img,
          #openpay-full-scanner__scan_region canvas {
            display: none !important;
          }
          #openpay-full-scanner__dashboard {
            display: none !important;
          }
          #openpay-full-scanner__dashboard_section_csr {
            display: none !important;
          }
        `}</style>
        <div id="openpay-full-scanner" className="absolute inset-0" />
        <div className={`absolute inset-0 ${scanning ? "bg-black/25" : "bg-black/60"} transition`} />

        <div className="relative z-10 h-[100dvh] overflow-y-auto overflow-x-hidden px-5 pt-4 pb-8">
          <div className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(returnTo)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/35"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold">Scan QR code</h1>
            <button
              onClick={() => setShowInstructions(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/35"
              aria-label="Help"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-8 text-center">
            <p className="text-3xl font-semibold">Please confirm</p>
            <p className="text-xl text-white/90">which QR you are scanning for payment</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <BrandLogo className="h-8 w-8" />
              <span className="text-4xl font-bold tracking-tight">OpenPay</span>
            </div>
          </div>

          <div className="mt-10 flex justify-center">
            <div className="relative h-[280px] w-[280px] border border-white/60 bg-black/10">
              <div className="absolute left-0 top-0 h-8 w-8 border-l-[6px] border-t-[6px] border-white" />
              <div className="absolute right-0 top-0 h-8 w-8 border-r-[6px] border-t-[6px] border-white" />
              <div className="absolute bottom-0 left-0 h-8 w-8 border-b-[6px] border-l-[6px] border-white" />
              <div className="absolute bottom-0 right-0 h-8 w-8 border-b-[6px] border-r-[6px] border-white" />
            </div>
          </div>

          <p className="mt-6 text-center text-2xl font-semibold">Position the QR code within the frame to pay</p>
          {scanError && <p className="mt-3 text-center text-sm text-red-300">{scanError}</p>}
          {!scanError && !scanning && <p className="mt-3 text-center text-sm text-white/80">Opening camera...</p>}

          <div className="mt-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleSelectFile(file);
                event.currentTarget.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-2xl border border-white/40 bg-black/25 py-4 text-3xl font-semibold"
            >
              <span className="inline-flex items-center gap-2">
                <ImageIcon className="h-6 w-6" />
                Select From Photos
              </span>
            </button>

            <div className="mt-3 rounded-2xl border border-white/30 bg-black/30 p-3">
              <p className="mb-2 text-sm text-white/85">Paste OpenPay code/link</p>
              <input
                value={pastedCode}
                onChange={(event) => setPastedCode(event.target.value)}
                placeholder="openpay://pay?... or https://.../send?to=..."
                className="h-11 w-full rounded-xl border border-white/30 bg-black/30 px-3 text-sm text-white placeholder:text-white/55"
              />
              <button
                onClick={() => void handleUsePastedCode()}
                className="mt-2 h-11 w-full rounded-xl border border-white/40 bg-black/35 text-lg font-semibold"
              >
                Use Pasted Code
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>

      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogTitle className="text-xl font-bold text-foreground">OpenPay Scan Instructions</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            For payment safety, follow these rules before scanning.
          </DialogDescription>

          <div className="rounded-2xl border border-border p-3 text-sm text-foreground">
            <p>1. Only scan OpenPay QR codes.</p>
            <p>2. Do not scan QR codes from other wallets or unknown apps.</p>
            <p>3. Verify the merchant username before you confirm payment.</p>
            <p>4. Only pay merchants or users you directly interacted with.</p>
            <p>5. Use Scan to Pay only for trusted payment requests.</p>
          </div>
          <div className="rounded-2xl border border-border bg-secondary/40 p-3 text-xs text-foreground">
            <p className="font-semibold">Allowed paste formats:</p>
            <p className="mt-1 break-all">openpay://pay?uid=&lt;user_uuid&gt;&amp;amount=10.00&amp;currency=USD</p>
            <p className="mt-1 break-all">https://your-openpay-domain/send?to=&lt;user_uuid&gt;&amp;amount=10.00&amp;currency=USD</p>
            <p className="mt-1">You can also paste only the recipient UUID.</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="h-11 flex-1 rounded-2xl" onClick={() => setShowInstructions(false)}>
              Close
            </Button>
            <Button className="h-11 flex-1 rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]" onClick={handleAcknowledgeInstructions}>
              I Understand
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QrScannerPage;
