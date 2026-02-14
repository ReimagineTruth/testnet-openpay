import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Info } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getFunctionErrorMessage } from "@/lib/supabaseFunctionError";

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
  const [balance, setBalance] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currency, format: formatCurrency } = useCurrency();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/signin"); return; }

      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .single();
      setBalance(wallet?.balance || 0);

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
    const parsedAmount = parseFloat(amount);
    if (!selectedUser || !amount || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (parsedAmount > balance) {
      toast.error("Amount exceeds your available balance");
      return;
    }
    setLoading(true);

    const { error } = await supabase.functions.invoke("send-money", {
      body: { receiver_email: "__by_id__", receiver_id: selectedUser.id, amount: parsedAmount, note },
    });

    setLoading(false);
    if (error) {
      toast.error(await getFunctionErrorMessage(error, "Transfer failed"));
    } else {
      toast.success(`${currency.symbol}${parseFloat(amount).toFixed(2)} sent to ${selectedUser.full_name}!`);
      navigate("/dashboard");
    }
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-paypal-dark", "bg-paypal-light-blue", "bg-primary", "bg-muted-foreground"];

  if (step === "amount") {
    return (
      <div className="min-h-screen bg-background px-4 pt-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep("select")}>
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <h1 className="text-lg font-semibold text-paypal-dark">Express Send</h1>
        </div>

        {selectedUser && (
          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-secondary/80 px-3 py-2.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-paypal-dark">
              <span className="text-sm font-bold text-primary-foreground">{getInitials(selectedUser.full_name)}</span>
            </div>
            <div>
              <p className="font-semibold text-foreground">{selectedUser.full_name}</p>
              {selectedUser.username && <p className="text-sm text-muted-foreground">@{selectedUser.username}</p>}
            </div>
          </div>
        )}

        <div className="paypal-surface mt-8 rounded-3xl p-6">
          <div className="mb-8 text-center">
            <p className="text-5xl font-bold text-foreground">
              {currency.symbol}{amount || "0.00"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{currency.flag} {currency.code}</p>
            <p className="mt-2 text-sm font-medium text-paypal-blue">Available: {formatCurrency(balance)}</p>
          </div>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mb-4 h-14 rounded-2xl border-white/70 bg-white text-center text-2xl"
            min="0.01"
            step="0.01"
          />
          <Input
            placeholder="Add a note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mb-6 h-12 rounded-2xl border-white/70 bg-white"
          />
          <Button
            onClick={handleSend}
            disabled={loading || !amount || parseFloat(amount) <= 0}
            className="h-14 w-full rounded-full bg-paypal-blue text-lg font-semibold text-white hover:bg-[#004dc5]"
          >
            {loading ? "Sending..." : `Send ${currency.symbol}${amount || "0.00"}`}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 pt-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <div className="flex-1">
          <Input
            placeholder="Name, username or email"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 rounded-full border border-white/70 bg-white pl-4"
            autoFocus
          />
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-4 font-bold text-foreground">{searchQuery ? "Search results" : "Your contacts"}</h2>
        <div className="paypal-surface overflow-hidden rounded-2xl">
          {filtered.map((user, i) => (
            <button
              key={user.id}
              onClick={() => handleSelectUser(user)}
              className="flex w-full items-center gap-3 border-b border-border/70 px-3 py-3 text-left last:border-b-0 hover:bg-secondary/50 transition"
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
        <DialogContent className="rounded-3xl">
          {selectedUser && (
            <div>
              <div className="w-16 h-16 rounded-full bg-paypal-dark flex items-center justify-center mb-3">
                <span className="text-lg font-bold text-primary-foreground">{getInitials(selectedUser.full_name)}</span>
              </div>
              <h3 className="text-xl font-bold">{selectedUser.full_name}</h3>
              {selectedUser.username && <p className="text-muted-foreground">@{selectedUser.username}</p>}
              <p className="text-2xl font-bold mt-4 mb-2">Is this the right person?</p>
              <Button onClick={handleConfirmUser} className="mt-4 h-14 w-full rounded-full bg-paypal-blue text-lg font-semibold text-white hover:bg-[#004dc5]">
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
