import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Send, ArrowLeftRight, CircleDollarSign, FileText, Wallet, Activity, HelpCircle, LogOut } from "lucide-react";
import { toast } from "sonner";

const MenuPage = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out");
    navigate("/signin");
  };

  const sections = [
    {
      title: "Send and pay",
      items: [
        { icon: Send, label: "Express Send", action: () => navigate("/send") },
        { icon: ArrowLeftRight, label: "Transfer balance", action: () => navigate("/topup") },
      ],
    },
    {
      title: "Get paid",
      items: [
        { icon: CircleDollarSign, label: "Request money", action: () => navigate("/request-money") },
        { icon: FileText, label: "Send invoice", action: () => navigate("/send-invoice") },
      ],
    },
    {
      title: "Manage finances",
      items: [
        { icon: Wallet, label: "Wallet", action: () => navigate("/dashboard") },
        { icon: Activity, label: "Activity", action: () => navigate("/activity") },
      ],
    },
    {
      title: "Get support",
      items: [
        { icon: HelpCircle, label: "Help Center", action: () => navigate("/help-center") },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 pt-6">
        <h1 className="paypal-heading mb-5">Menu</h1>
        {sections.map((section) => (
          <div key={section.title} className="mb-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</h2>
            <div className="paypal-surface overflow-hidden rounded-2xl">
            {section.items.map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                onClick={action}
                className="flex w-full items-center gap-4 border-b border-border/60 px-3 py-3.5 text-left last:border-b-0 hover:bg-secondary/60 transition"
              >
                <Icon className="h-5 w-5 text-paypal-blue" />
                <span className="text-foreground font-medium">{label}</span>
              </button>
            ))}
            </div>
          </div>
        ))}

        <button
          onClick={handleLogout}
          className="paypal-surface w-full flex items-center gap-4 rounded-2xl px-3 py-3.5 transition hover:bg-red-50 text-destructive"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Log Out</span>
        </button>
      </div>

      <BottomNav active="menu" />
    </div>
  );
};

export default MenuPage;
