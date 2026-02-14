import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      } else {
        navigate("/signin");
      }
      setChecking(false);
    });
  }, [navigate]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <svg viewBox="0 0 100 100" className="w-24 h-24 animate-pulse">
          <path d="M35 20h20c12 0 20 8 20 20s-8 20-20 20H45v20H35V20z" fill="hsl(210 100% 90%)" />
          <path d="M40 25h20c10 0 17 7 17 17s-7 17-17 17H50v20H40V25z" fill="white" />
        </svg>
      </div>
    );
  }

  return null;
};

export default Index;
