import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const SignUp = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, username },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Account created!");
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
          <h1 className="text-2xl font-bold text-foreground mb-6 text-center">Sign Up</h1>
          <form onSubmit={handleSignUp} className="space-y-4">
            <Input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="h-12 rounded-xl"
            />
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="h-12 rounded-xl"
            />
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
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-12 rounded-xl"
            />
            <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-lg font-semibold">
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>
          <p className="text-center mt-6 text-muted-foreground">
            Already have an account?{" "}
            <Link to="/signin" className="text-paypal-light-blue font-semibold">Log In</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
