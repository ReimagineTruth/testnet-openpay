import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

type NotificationItem = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/signin");
        return;
      }

      const { data } = await supabase
        .from("app_notifications")
        .select("id, title, body, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      const notifications: NotificationItem[] = (data || []).map((item) => ({
        id: String(item.id),
        title: String(item.title || "Notification"),
        description: String(item.body || ""),
        createdAt: String(item.created_at || new Date().toISOString()),
      }));

      setItems(notifications);

      await supabase
        .from("app_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null);

      setLoading(false);
    };

    load();
  }, [navigate]);

  const empty = useMemo(() => !loading && items.length === 0, [items.length, loading]);

  return (
    <div className="min-h-screen bg-background px-4 pt-4">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate("/dashboard")} className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-paypal-dark">Notifications</h1>
      </div>

      <div className="paypal-surface overflow-hidden rounded-3xl">
        {loading && <p className="p-4 text-sm text-muted-foreground">Loading notifications...</p>}
        {empty && (
          <div className="p-8 text-center">
            <Bell className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
          </div>
        )}
        {items.map((item) => (
          <div key={item.id} className="border-b border-border/60 p-4 last:border-b-0">
            <p className="font-semibold text-foreground">{item.title}</p>
            <p className="text-sm text-muted-foreground">{item.description}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationsPage;
