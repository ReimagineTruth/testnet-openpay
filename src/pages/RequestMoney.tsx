import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getFunctionErrorMessage } from "@/lib/supabaseFunctionError";

interface Profile {
  id: string;
  full_name: string;
  username: string | null;
}

interface PaymentRequest {
  id: string;
  requester_id: string;
  payer_id: string;
  amount: number;
  note: string | null;
  status: string;
  created_at: string;
}

const RequestMoney = () => {
  const navigate = useNavigate();
  const { format: formatCurrency } = useCurrency();
  const [userId, setUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [payerId, setPayerId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/signin");
      return;
    }
    setUserId(user.id);

    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, full_name, username")
      .neq("id", user.id);

    const { data: requestRows } = await supabase
      .from("payment_requests")
      .select("id, requester_id, payer_id, amount, note, status, created_at")
      .or(`requester_id.eq.${user.id},payer_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    setProfiles(profileRows || []);
    setRequests(requestRows || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredProfiles = search
    ? profiles.filter((p) =>
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.username && p.username.toLowerCase().includes(search.toLowerCase())))
    : profiles;

  const incoming = requests.filter((r) => r.payer_id === userId);
  const outgoing = requests.filter((r) => r.requester_id === userId);

  const handleCreate = async () => {
    if (!userId || !payerId) {
      toast.error("Select who you are requesting from");
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("payment_requests").insert({
      requester_id: userId,
      payer_id: payerId,
      amount: parsedAmount,
      note: note.trim() || "",
      status: "pending",
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Request sent");
    setAmount("");
    setNote("");
    setPayerId("");
    await loadData();
  };

  const handlePay = async (request: PaymentRequest) => {
    setLoading(true);
    const { error } = await supabase.functions.invoke("send-money", {
      body: {
        receiver_id: request.requester_id,
        receiver_email: "__by_id__",
        amount: request.amount,
        note: request.note || "Payment request",
      },
    });

    if (error) {
      setLoading(false);
      toast.error(await getFunctionErrorMessage(error, "Payment failed"));
      return;
    }

    const { error: updateError } = await supabase
      .from("payment_requests")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", request.id);

    setLoading(false);
    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    toast.success("Request paid");
    await loadData();
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase
      .from("payment_requests")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Request rejected");
    await loadData();
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="flex items-center gap-3 px-4 pt-4 mb-4">
        <button onClick={() => navigate("/menu")}>
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Request Money</h1>
      </div>

      <div className="px-4 space-y-4">
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Create request</h2>
          <Input
            placeholder="Search person by name or username"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-40 overflow-auto rounded-xl border border-border">
            {filteredProfiles.map((p) => (
              <button
                key={p.id}
                onClick={() => setPayerId(p.id)}
                className={`w-full text-left px-3 py-2 hover:bg-muted ${payerId === p.id ? "bg-muted" : ""}`}
              >
                <p className="font-medium text-foreground">{p.full_name}</p>
                {p.username && <p className="text-sm text-muted-foreground">@{p.username}</p>}
              </button>
            ))}
            {filteredProfiles.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground">No users found</p>
            )}
          </div>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Textarea
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button onClick={handleCreate} disabled={loading || !payerId} className="w-full">
            {loading ? "Sending..." : "Send Request"}
          </Button>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Incoming requests</h2>
          {incoming.length === 0 && <p className="text-sm text-muted-foreground">No incoming requests</p>}
          {incoming.map((request) => {
            const requester = profileMap.get(request.requester_id);
            return (
              <div key={request.id} className="border border-border rounded-xl p-3">
                <p className="font-medium text-foreground">{requester?.full_name || "Unknown user"}</p>
                <p className="text-sm text-muted-foreground">{format(new Date(request.created_at), "MMM d, yyyy")}</p>
                <p className="font-semibold mt-1">{formatCurrency(request.amount)}</p>
                {request.note && <p className="text-sm text-muted-foreground mt-1">{request.note}</p>}
                <p className="text-sm mt-1 capitalize">Status: {request.status}</p>
                {request.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <Button className="flex-1" disabled={loading} onClick={() => handlePay(request)}>
                      Pay
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={loading}
                      onClick={() => handleReject(request.id)}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Sent requests</h2>
          {outgoing.length === 0 && <p className="text-sm text-muted-foreground">No requests sent yet</p>}
          {outgoing.map((request) => {
            const payer = profileMap.get(request.payer_id);
            return (
              <div key={request.id} className="border border-border rounded-xl p-3">
                <p className="font-medium text-foreground">{payer?.full_name || "Unknown user"}</p>
                <p className="text-sm text-muted-foreground">{format(new Date(request.created_at), "MMM d, yyyy")}</p>
                <p className="font-semibold mt-1">{formatCurrency(request.amount)}</p>
                {request.note && <p className="text-sm text-muted-foreground mt-1">{request.note}</p>}
                <p className="text-sm mt-1 capitalize">Status: {request.status}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RequestMoney;
