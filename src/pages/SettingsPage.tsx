import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const SettingsPage = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
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
    await supabase.auth.signOut();
    navigate("/auth");
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
