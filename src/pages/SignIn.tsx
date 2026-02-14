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
    <div className="min-h-screen bg-gradient-to-b from-paypal-blue to-[#072a7a] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-sm flex-col justify-center">
        <div className="mb-8 text-center">
          <svg viewBox="0 0 100 100" className="mx-auto mb-4 h-16 w-16">
            <path d="M35 20h20c12 0 20 8 20 20s-8 20-20 20H45v20H35V20z" fill="#8FC9FF" />
            <path d="M40 25h20c10 0 17 7 17 17s-7 17-17 17H50v20H40V25z" fill="white" />
          </svg>
          <p className="text-sm font-medium text-white/85">Welcome back</p>
        </div>
        <div className="paypal-surface w-full rounded-3xl p-7 shadow-2xl shadow-black/15">
          <h1 className="paypal-heading mb-6 text-center">Log In</h1>
          <form onSubmit={handleSignIn} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 rounded-2xl border-white/70 bg-white"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-12 rounded-2xl border-white/70 bg-white"
            />
            <Button type="submit" disabled={loading} className="w-full h-12 rounded-2xl bg-paypal-blue text-primary-foreground text-base font-semibold hover:bg-[#004dc5]">
              {loading ? "Signing in..." : "Log In"}
            </Button>
          </form>
          <p className="text-center mt-6 text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="text-paypal-blue font-semibold">Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
