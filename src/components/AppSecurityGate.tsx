import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearAppSecurityUnlock,
  hasAnyAppSecurityMethod,
  isAppSecurityUnlocked,
  loadAppSecuritySettings,
  markAppSecurityUnlocked,
  hashSecret,
  saveAppSecuritySettings,
  verifyBiometricCredential,
} from "@/lib/appSecurity";
import { loadUserPreferences } from "@/lib/userPreferences";

const PUBLIC_PATHS = new Set([
  "/",
  "/auth",
  "/signin",
  "/signup",
  "/admin-mrwain",
  "/terms",
  "/privacy",
  "/about-openpay",
  "/legal",
]);

const AppSecurityGate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [locked, setLocked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(() => ({} as ReturnType<typeof loadAppSecuritySettings>));

  const hasPin = Boolean(settings.pinHash);
  const hasPassword = Boolean(settings.passwordHash);
  const hasBiometric = Boolean(settings.biometricEnabled && settings.biometricCredentialId);

  const shouldSkipPath = useMemo(() => {
    if (location.pathname.startsWith("/admin")) return true;
    return PUBLIC_PATHS.has(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const check = async () => {
      setError("");
      if (shouldSkipPath) {
        setLocked(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLocked(false);
        return;
      }

      const currentUserId = user.id;
      setUserId(currentUserId);
      let loaded = loadAppSecuritySettings(currentUserId);
      if (!hasAnyAppSecurityMethod(loaded)) {
        try {
          const prefs = await loadUserPreferences(currentUserId);
          if (hasAnyAppSecurityMethod(prefs.security_settings)) {
            loaded = prefs.security_settings;
            saveAppSecuritySettings(currentUserId, loaded);
          }
        } catch {
          // Keep local-only behavior if preference table is unavailable.
        }
      }
      setSettings(loaded);

      if (!hasAnyAppSecurityMethod(loaded)) {
        setLocked(false);
        return;
      }

      if (isAppSecurityUnlocked(currentUserId)) {
        setLocked(false);
        return;
      }

      setLocked(true);
    };

    check();
  }, [shouldSkipPath, location.pathname]);

  const unlockSuccess = () => {
    if (!userId) return;
    markAppSecurityUnlocked(userId);
    setLocked(false);
    setPin("");
    setPassword("");
    setError("");
  };

  const handleUnlockWithPin = async () => {
    if (!settings.pinHash) return;
    setBusy(true);
    const hashed = await hashSecret(pin);
    setBusy(false);
    if (hashed !== settings.pinHash) {
      setError("Invalid PIN.");
      return;
    }
    unlockSuccess();
  };

  const handleUnlockWithPassword = async () => {
    if (!settings.passwordHash) return;
    setBusy(true);
    const hashed = await hashSecret(password);
    setBusy(false);
    if (hashed !== settings.passwordHash) {
      setError("Invalid security password.");
      return;
    }
    unlockSuccess();
  };

  const handleUnlockWithBiometric = async () => {
    if (!settings.biometricCredentialId) return;
    setBusy(true);
    setError("");
    try {
      await verifyBiometricCredential(settings.biometricCredentialId);
      unlockSuccess();
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : "Biometric unlock failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    if (userId) clearAppSecurityUnlock(userId);
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!locked) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-paypal-blue px-4 py-8">
      <div className="mx-auto mt-12 w-full max-w-sm rounded-3xl border border-[#c8d9ff] bg-white p-5 shadow-2xl shadow-[#003e9a]/30">
        <h2 className="text-2xl font-bold text-foreground">Unlock OpenPay</h2>
        <p className="mt-1 text-sm text-muted-foreground">Use your security method to continue.</p>

        {hasPin && (
          <div className="mt-4">
            <p className="mb-1 text-sm text-muted-foreground">PIN</p>
            <Input
              type="password"
              inputMode="numeric"
              placeholder="Enter PIN"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              className="h-12 rounded-2xl bg-white"
            />
            <Button disabled={busy || !pin.trim()} onClick={handleUnlockWithPin} className="mt-2 h-11 w-full rounded-2xl">
              Unlock with PIN
            </Button>
          </div>
        )}

        {hasPassword && (
          <div className="mt-4">
            <p className="mb-1 text-sm text-muted-foreground">Security Password</p>
            <Input
              type="password"
              placeholder="Enter security password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 rounded-2xl bg-white"
            />
            <Button disabled={busy || !password.trim()} onClick={handleUnlockWithPassword} className="mt-2 h-11 w-full rounded-2xl">
              Unlock with Password
            </Button>
          </div>
        )}

        {hasBiometric && (
          <Button disabled={busy} onClick={handleUnlockWithBiometric} className="mt-4 h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]">
            Use Face ID / Fingerprint
          </Button>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <Button variant="outline" onClick={handleLogout} className="mt-4 h-11 w-full rounded-2xl">
          Log Out
        </Button>
      </div>
    </div>
  );
};

export default AppSecurityGate;
