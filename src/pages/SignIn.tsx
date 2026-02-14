import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const SignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-primary">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="mb-10">
          <svg viewBox="0 0 100 100" className="w-20 h-20 mx-auto">
            <path d="M35 20h20c12 0 20 8 20 20s-8 20-20 20H45v20H35V20z" fill="hsl(210 100% 90%)" />
            <path d="M40 25h20c10 0 17 7 17 17s-7 17-17 17H50v20H40V25z" fill="white" />
          </svg>
        </div>
        <div className="w-full max-w-sm bg-card rounded-2xl p-6 shadow-lg">
          <h1 className="text-2xl font-bold text-foreground mb-6 text-center">Log In</h1>
          <form onSubmit={handleSignIn} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 rounded-xl"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-12 rounded-xl"
            />
            <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-lg font-semibold">
              {loading ? "Signing in..." : "Log In"}
            </Button>
          </form>
          <p className="text-center mt-6 text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="text-paypal-light-blue font-semibold">Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
