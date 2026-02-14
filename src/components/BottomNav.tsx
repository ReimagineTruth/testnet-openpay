import { useNavigate } from "react-router-dom";
import { Home, Users, Menu } from "lucide-react";

interface BottomNavProps {
  active: "home" | "contacts" | "menu";
}

const BottomNav = ({ active }: BottomNavProps) => {
  const navigate = useNavigate();

  const items = [
    { key: "home" as const, label: "Home", icon: Home, path: "/dashboard" },
    { key: "contacts" as const, label: "Contacts", icon: Users, path: "/contacts" },
    { key: "menu" as const, label: "Menu", icon: Menu, path: "/menu" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
      <div className="flex items-center justify-around py-2">
        {items.map(({ key, label, icon: Icon, path }) => (
          <button
            key={key}
            onClick={() => navigate(path)}
            className={`flex flex-col items-center gap-1 px-6 py-1 ${
              active === key ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            <Icon className="w-6 h-6" />
            <span className={`text-xs ${active === key ? "font-bold" : ""}`}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default BottomNav;
