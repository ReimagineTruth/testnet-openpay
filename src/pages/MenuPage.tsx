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
        { icon: Send, label: "Send Money", action: () => navigate("/send") },
        { icon: ArrowLeftRight, label: "Transfer balance", action: () => navigate("/topup") },
      ],
    },
    {
      title: "Get paid",
      items: [
        { icon: CircleDollarSign, label: "Request money", action: () => toast.info("Coming soon") },
        { icon: FileText, label: "Send invoice", action: () => toast.info("Coming soon") },
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
        { icon: HelpCircle, label: "Help Center", action: () => toast.info("Coming soon") },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-6">
        {sections.map((section) => (
          <div key={section.title} className="mb-6">
            <h2 className="text-lg font-bold text-foreground mb-3">{section.title}</h2>
            {section.items.map(({ icon: Icon, label, action }) => (
              <button
                key={label}
                onClick={action}
                className="w-full flex items-center gap-4 py-3 hover:bg-muted rounded-xl px-2 transition"
              >
                <Icon className="w-6 h-6 text-foreground" />
                <span className="text-foreground font-medium">{label}</span>
              </button>
            ))}
          </div>
        ))}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-4 py-3 hover:bg-muted rounded-xl px-2 transition text-destructive"
        >
          <LogOut className="w-6 h-6" />
          <span className="font-medium">Log Out</span>
        </button>
      </div>

      <BottomNav active="menu" />
    </div>
  );
};

export default MenuPage;
