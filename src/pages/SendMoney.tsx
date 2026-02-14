import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Info } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCurrency } from "@/contexts/CurrencyContext";

interface UserProfile {
  id: string;
  full_name: string;
  username: string | null;
}

const SendMoney = () => {
  const [step, setStep] = useState<"select" | "amount" | "confirm">("select");
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { format: formatCurrency, currency } = useCurrency();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/signin"); return; }

      // Load contacts
      const { data: contactRows } = await supabase
        .from("contacts")
        .select("contact_id")
        .eq("user_id", user.id);

      const contactIds = contactRows?.map(c => c.contact_id) || [];

      // Load all profiles for search
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .neq("id", user.id);

      if (profiles) {
        setAllUsers(profiles);
        setContacts(profiles.filter(p => contactIds.includes(p.id)));
      }

      // Pre-select if coming from contacts
      const toId = searchParams.get("to");
      if (toId && profiles) {
        const found = profiles.find(p => p.id === toId);
        if (found) {
          setSelectedUser(found);
          setStep("amount");
        }
      }
    };
    load();
  }, [navigate, searchParams]);

  const filtered = searchQuery
    ? allUsers.filter(u =>
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : contacts;

  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
    setShowConfirm(true);
  };

  const handleConfirmUser = () => {
    setShowConfirm(false);
    setStep("amount");
  };

  const handleSend = async () => {
    if (!selectedUser || !amount || parseFloat(amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setLoading(true);

    // Get the user's email from profiles won't work, need to use edge function
    const { data: { session } } = await supabase.auth.getSession();

    // We need to find receiver email. Since we can't query auth.users from client,
    // the edge function will need receiver_id instead. Let me update the approach.
    const { data, error } = await supabase.functions.invoke("send-money", {
      body: { receiver_email: "__by_id__", receiver_id: selectedUser.id, amount: parseFloat(amount), note },
    });

    setLoading(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Transfer failed");
    } else {
      toast.success(`${currency.symbol}${parseFloat(amount).toFixed(2)} sent to ${selectedUser.full_name}!`);
      navigate("/dashboard");
    }
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-paypal-dark", "bg-paypal-light-blue", "bg-primary", "bg-muted-foreground"];

  if (step === "amount") {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center gap-3 px-4 pt-4">
          <button onClick={() => setStep("select")}>
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Send</h1>
        </div>

        {selectedUser && (
          <div className="flex items-center gap-3 px-4 mt-6">
            <div className="w-12 h-12 rounded-full bg-paypal-dark flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">{getInitials(selectedUser.full_name)}</span>
            </div>
            <div>
              <p className="font-semibold text-foreground">{selectedUser.full_name}</p>
              {selectedUser.username && <p className="text-sm text-muted-foreground">@{selectedUser.username}</p>}
            </div>
          </div>
        )}

        <div className="px-4 mt-8">
          <div className="text-center mb-8">
            <p className="text-5xl font-bold text-foreground">
              {currency.symbol}{amount || "0.00"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{currency.flag} {currency.code}</p>
          </div>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-14 rounded-xl text-center text-2xl mb-4"
            min="0.01"
            step="0.01"
          />
          <Input
            placeholder="Add a note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-12 rounded-xl mb-6"
          />
          <Button
            onClick={handleSend}
            disabled={loading || !amount || parseFloat(amount) <= 0}
            className="w-full h-14 rounded-full bg-foreground text-background text-lg font-bold"
          >
            {loading ? "Sending..." : `Send ${currency.symbol}${amount || "0.00"}`}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center gap-3 px-4 pt-4">
        <button onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <div className="flex-1">
          <Input
            placeholder="Name, username or email"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 rounded-full bg-secondary border-2 border-paypal-light-blue"
            autoFocus
          />
        </div>
      </div>

      <div className="px-4 mt-6">
        <h2 className="font-bold text-foreground mb-4">{searchQuery ? "Search results" : "Your contacts"}</h2>
        <div className="space-y-1">
          {filtered.map((user, i) => (
            <button
              key={user.id}
              onClick={() => handleSelectUser(user)}
              className="w-full flex items-center gap-3 py-3 px-2 hover:bg-muted rounded-xl transition"
            >
              <div className={`w-12 h-12 rounded-full ${colors[i % colors.length]} flex items-center justify-center`}>
                <span className="text-sm font-bold text-primary-foreground">{getInitials(user.full_name)}</span>
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-foreground">{user.full_name}</p>
                {user.username && <p className="text-sm text-muted-foreground">@{user.username}</p>}
              </div>
              <Info className="w-5 h-5 text-muted-foreground" />
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No users found</p>
          )}
        </div>
      </div>

      {/* Confirm User Sheet */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="rounded-t-2xl">
          {selectedUser && (
            <div>
              <div className="w-16 h-16 rounded-full bg-paypal-dark flex items-center justify-center mb-3">
                <span className="text-lg font-bold text-primary-foreground">{getInitials(selectedUser.full_name)}</span>
              </div>
              <h3 className="text-xl font-bold">{selectedUser.full_name}</h3>
              {selectedUser.username && <p className="text-muted-foreground">@{selectedUser.username}</p>}
              <p className="text-2xl font-bold mt-4 mb-2">Is this the right person?</p>
              <Button onClick={handleConfirmUser} className="w-full h-14 rounded-full bg-foreground text-background text-lg font-bold mt-4">
                Continue
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SendMoney;
