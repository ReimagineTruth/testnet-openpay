import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AppSecuritySettings,
  clearAllAppSecurityUnlocks,
  clearAppSecurityUnlock,
  hashSecret,
  isBiometricSupported,
  loadAppSecuritySettings,
  registerBiometricCredential,
  saveAppSecuritySettings,
} from "@/lib/appSecurity";

const SettingsPage = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [securitySettings, setSecuritySettings] = useState<AppSecuritySettings>({});
  const [pin, setPin] = useState("");
  const [securityPassword, setSecurityPassword] = useState("");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/signin");
        return;
      }
      setUserId(user.id);
      setSecuritySettings(loadAppSecuritySettings(user.id));

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", user.id)
        .single();

      setFullName(profile?.full_name || "");
      setUsername(profile?.username || "");
    };

    load();
  }, [navigate]);

  const handleSave = async () => {
    if (!userId) return;
    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        username: username.trim() || null,
      })
      .eq("id", userId);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Settings saved");
  };

  const handleLogout = async () => {
    clearAllAppSecurityUnlocks();
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleSetPin = async () => {
    if (!userId) return;
    if (!/^\d{4,8}$/.test(pin.trim())) {
      toast.error("PIN must be 4 to 8 digits");
      return;
    }
    setSavingSecurity(true);
    const pinHash = await hashSecret(pin);
    const updated: AppSecuritySettings = { ...securitySettings, pinHash };
    saveAppSecuritySettings(userId, updated);
    clearAppSecurityUnlock(userId);
    setSecuritySettings(updated);
    setPin("");
    setSavingSecurity(false);
    toast.success("PIN security enabled");
  };

  const handleSetSecurityPassword = async () => {
    if (!userId) return;
    if (securityPassword.trim().length < 6) {
      toast.error("Security password must be at least 6 characters");
      return;
    }
    setSavingSecurity(true);
    const passwordHash = await hashSecret(securityPassword);
    const updated: AppSecuritySettings = { ...securitySettings, passwordHash };
    saveAppSecuritySettings(userId, updated);
    clearAppSecurityUnlock(userId);
    setSecuritySettings(updated);
    setSecurityPassword("");
    setSavingSecurity(false);
    toast.success("Security password enabled");
  };

  const handleSetupBiometric = async () => {
    if (!userId) return;
    if (!isBiometricSupported()) {
      toast.error("Face ID / Fingerprint is not supported on this device.");
      return;
    }
    setSavingSecurity(true);
    try {
      const credentialId = await registerBiometricCredential(userId, fullName || "OpenPay User");
      const updated: AppSecuritySettings = {
        ...securitySettings,
        biometricEnabled: true,
        biometricCredentialId: credentialId,
      };
      saveAppSecuritySettings(userId, updated);
      clearAppSecurityUnlock(userId);
      setSecuritySettings(updated);
      toast.success("Face ID / Fingerprint enabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to set up biometrics");
    } finally {
      setSavingSecurity(false);
    }
  };

  const handleDisablePin = () => {
    if (!userId) return;
    const updated: AppSecuritySettings = { ...securitySettings };
    delete updated.pinHash;
    saveAppSecuritySettings(userId, updated);
    setSecuritySettings(updated);
    toast.success("PIN security disabled");
  };

  const handleDisableSecurityPassword = () => {
    if (!userId) return;
    const updated: AppSecuritySettings = { ...securitySettings };
    delete updated.passwordHash;
    saveAppSecuritySettings(userId, updated);
    setSecuritySettings(updated);
    toast.success("Security password disabled");
  };

  const handleDisableBiometric = () => {
    if (!userId) return;
    const updated: AppSecuritySettings = { ...securitySettings, biometricEnabled: false };
    delete updated.biometricCredentialId;
    saveAppSecuritySettings(userId, updated);
    setSecuritySettings(updated);
    toast.success("Face ID / Fingerprint disabled");
  };

  const handleEnableNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Notifications are not supported on this device");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") toast.success("Device notifications enabled");
    else toast.error("Notification permission not granted");
  };

  return (
    <div className="min-h-screen bg-background px-4 pt-4">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate("/dashboard")} className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-paypal-dark">Settings</h1>
      </div>

      <div className="paypal-surface rounded-3xl p-4">
        <button
          onClick={() => navigate("/profile")}
          className="mb-4 w-full rounded-2xl border border-border/70 bg-secondary/60 px-3 py-3 text-left font-semibold text-paypal-blue hover:bg-secondary"
        >
          Open Profile
        </button>
        <button
          onClick={handleEnableNotifications}
          className="mb-4 w-full rounded-2xl border border-border/70 bg-secondary/60 px-3 py-3 text-left font-semibold text-paypal-blue hover:bg-secondary"
        >
          {notificationPermission === "granted" ? "Device notifications enabled" : "Enable device notifications"}
        </button>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Full Name</p>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-12 rounded-2xl bg-white" />
          </div>
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Username</p>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} className="h-12 rounded-2xl bg-white" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="mt-5 h-12 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]">
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-4">
        <h2 className="text-lg font-bold text-foreground">App Security</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add PIN, security password, and device biometrics to protect your account on this device.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Set PIN (4-8 digits)</p>
            <Input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={securitySettings.pinHash ? "Update PIN" : "Create PIN"}
              className="h-12 rounded-2xl bg-white"
            />
            <div className="mt-2 flex gap-2">
              <Button onClick={handleSetPin} disabled={savingSecurity || !pin.trim()} className="h-10 flex-1 rounded-2xl">
                {securitySettings.pinHash ? "Update PIN" : "Enable PIN"}
              </Button>
              {securitySettings.pinHash && (
                <Button variant="outline" onClick={handleDisablePin} className="h-10 rounded-2xl">
                  Disable
                </Button>
              )}
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm text-muted-foreground">Set Security Password</p>
            <Input
              type="password"
              value={securityPassword}
              onChange={(e) => setSecurityPassword(e.target.value)}
              placeholder={securitySettings.passwordHash ? "Update security password" : "Create security password"}
              className="h-12 rounded-2xl bg-white"
            />
            <div className="mt-2 flex gap-2">
              <Button onClick={handleSetSecurityPassword} disabled={savingSecurity || !securityPassword.trim()} className="h-10 flex-1 rounded-2xl">
                {securitySettings.passwordHash ? "Update Password" : "Enable Password"}
              </Button>
              {securitySettings.passwordHash && (
                <Button variant="outline" onClick={handleDisableSecurityPassword} className="h-10 rounded-2xl">
                  Disable
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-secondary/50 p-3">
            <p className="text-sm font-semibold text-foreground">Face ID / Fingerprint</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Requires supported device/browser with HTTPS.
            </p>
            <div className="mt-2 flex gap-2">
              <Button onClick={handleSetupBiometric} disabled={savingSecurity} className="h-10 flex-1 rounded-2xl">
                {securitySettings.biometricCredentialId ? "Reconfigure Biometric" : "Enable Biometric"}
              </Button>
              {securitySettings.biometricCredentialId && (
                <Button variant="outline" onClick={handleDisableBiometric} className="h-10 rounded-2xl">
                  Disable
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="paypal-surface mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 font-semibold text-destructive hover:bg-red-50"
      >
        <LogOut className="h-4 w-4" />
        Log Out
      </button>

      <div className="mt-4 text-center text-sm text-muted-foreground">
        <Link to="/terms" className="text-paypal-blue font-medium">Terms</Link>
        {" · "}
        <Link to="/privacy" className="text-paypal-blue font-medium">Privacy Policy</Link>
      </div>
    </div>
  );
};

export default SettingsPage;
