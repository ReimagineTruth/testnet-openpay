import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, HelpCircle, ImageIcon } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import BrandLogo from "@/components/BrandLogo";

const extractQrPayload = (rawValue: string) => {
  const value = rawValue.trim();
  if (!value) return { uid: null as string | null, amount: "", currency: "" };

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(value)) return { uid: value, amount: "", currency: "" };

  try {
    const parsed = new URL(value);
    const uid = parsed.searchParams.get("uid") || parsed.searchParams.get("to");
    const amount = parsed.searchParams.get("amount") || "";
    const currencyCode = (parsed.searchParams.get("currency") || "").toUpperCase();
    return { uid: uid && uuidRegex.test(uid) ? uid : null, amount, currency: currencyCode };
  } catch {
    // no-op
  }

  const maybeUid = value.split("uid=")[1]?.split("&")[0];
  const maybeAmount = value.split("amount=")[1]?.split("&")[0] || "";
  const maybeCurrency = (value.split("currency=")[1]?.split("&")[0] || "").toUpperCase();
  return { uid: maybeUid && uuidRegex.test(maybeUid) ? maybeUid : null, amount: maybeAmount, currency: maybeCurrency };
};

const QrScannerPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [scanError, setScanError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [pastedCode, setPastedCode] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleDecoded = async (decodedText: string) => {
    const payload = extractQrPayload(decodedText);
    await stopScanner();
    if (!payload.uid) {
      toast.error("Invalid QR code");
      return;
    }

    const params = new URLSearchParams({ to: payload.uid });
    if (payload.amount && Number.isFinite(Number(payload.amount)) && Number(payload.amount) > 0) {
      params.set("amount", Number(payload.amount).toFixed(2));
    }
    if (payload.currency) {
      params.set("currency", payload.currency);
    }

    navigate(`${returnTo}?${params.toString()}`, { replace: true });
  };

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        if (mounted) setScanError("Camera requires HTTPS (or localhost).");
        return;
      }
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        if (mounted) setScanError("Camera is not available on this device/browser.");
        return;
      }

      const scanner = new Html5Qrcode("openpay-full-scanner");
      scannerRef.current = scanner;

      try {
        const cameras = await Html5Qrcode.getCameras();
        const preferredBack = cameras.find((cam) => /(back|rear|environment)/i.test(cam.label || ""));
        const sources: Array<string | MediaTrackConstraints> = [];
        if (preferredBack?.id) sources.push(preferredBack.id);
        if (cameras[0]?.id) sources.push(cameras[0].id);
        sources.push({ facingMode: { exact: "environment" } });
        sources.push({ facingMode: "environment" });
        sources.push({ facingMode: "user" });

        const scanConfig = { fps: 10, qrbox: { width: 260, height: 260 } };

        let started = false;
        let startError = "";
        for (const source of sources) {
          try {
            await scanner.start(source, scanConfig, (decodedText) => {
              void handleDecoded(decodedText);
            }, () => undefined);
            started = true;
            if (mounted) setScanning(true);
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

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="relative min-h-screen overflow-hidden">
        <div id="openpay-full-scanner" className="absolute inset-0" />
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" />

        <div className="relative z-10 flex min-h-screen flex-col px-5 pt-4 pb-6">
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
              onClick={() => toast.message("Use OpenPay receive QR for fastest match.")}
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
  );
};

export default QrScannerPage;
