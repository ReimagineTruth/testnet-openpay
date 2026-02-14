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

interface Invoice {
  id: string;
  sender_id: string;
  recipient_id: string;
  amount: number;
  description: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
}

const SendInvoice = () => {
  const navigate = useNavigate();
  const { format: formatCurrency } = useCurrency();
  const [userId, setUserId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [recipientId, setRecipientId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
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

    const { data: invoiceRows } = await supabase
      .from("invoices")
      .select("id, sender_id, recipient_id, amount, description, due_date, status, created_at")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    setProfiles(profileRows || []);
    setInvoices(invoiceRows || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredProfiles = search
    ? profiles.filter((p) =>
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.username && p.username.toLowerCase().includes(search.toLowerCase())))
    : profiles;

  const received = invoices.filter((i) => i.recipient_id === userId);
  const sent = invoices.filter((i) => i.sender_id === userId);

  const handleCreate = async () => {
    if (!userId || !recipientId) {
      toast.error("Select recipient");
      return;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("invoices").insert({
      sender_id: userId,
      recipient_id: recipientId,
      amount: parsedAmount,
      description: description.trim() || "",
      due_date: dueDate || null,
      status: "pending",
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Invoice sent");
    setAmount("");
    setDescription("");
    setDueDate("");
    setRecipientId("");
    await loadData();
  };

  const handlePay = async (invoice: Invoice) => {
    setLoading(true);
    const { error } = await supabase.functions.invoke("send-money", {
      body: {
        receiver_id: invoice.sender_id,
        receiver_email: "__by_id__",
        amount: invoice.amount,
        note: invoice.description || "Invoice payment",
      },
    });

    if (error) {
      setLoading(false);
      toast.error(await getFunctionErrorMessage(error, "Payment failed"));
      return;
    }

    const { error: updateError } = await supabase
      .from("invoices")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", invoice.id);

    setLoading(false);
    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    toast.success("Invoice paid");
    await loadData();
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="flex items-center gap-3 px-4 pt-4 mb-4">
        <button onClick={() => navigate("/menu")}>
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Send Invoice</h1>
      </div>

      <div className="px-4 space-y-4">
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Create invoice</h2>
          <Input
            placeholder="Search person by name or username"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-40 overflow-auto rounded-xl border border-border">
            {filteredProfiles.map((p) => (
              <button
                key={p.id}
                onClick={() => setRecipientId(p.id)}
                className={`w-full text-left px-3 py-2 hover:bg-muted ${recipientId === p.id ? "bg-muted" : ""}`}
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
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button onClick={handleCreate} disabled={loading || !recipientId} className="w-full">
            {loading ? "Sending..." : "Send Invoice"}
          </Button>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Received invoices</h2>
          {received.length === 0 && <p className="text-sm text-muted-foreground">No received invoices</p>}
          {received.map((invoice) => {
            const sender = profileMap.get(invoice.sender_id);
            return (
              <div key={invoice.id} className="border border-border rounded-xl p-3">
                <p className="font-medium text-foreground">{sender?.full_name || "Unknown user"}</p>
                <p className="text-sm text-muted-foreground">{format(new Date(invoice.created_at), "MMM d, yyyy")}</p>
                <p className="font-semibold mt-1">{formatCurrency(invoice.amount)}</p>
                {invoice.description && <p className="text-sm text-muted-foreground mt-1">{invoice.description}</p>}
                {invoice.due_date && <p className="text-sm text-muted-foreground mt-1">Due: {invoice.due_date}</p>}
                <p className="text-sm mt-1 capitalize">Status: {invoice.status}</p>
                {invoice.status === "pending" && (
                  <Button className="w-full mt-3" disabled={loading} onClick={() => handlePay(invoice)}>
                    Pay Invoice
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Sent invoices</h2>
          {sent.length === 0 && <p className="text-sm text-muted-foreground">No sent invoices</p>}
          {sent.map((invoice) => {
            const recipient = profileMap.get(invoice.recipient_id);
            return (
              <div key={invoice.id} className="border border-border rounded-xl p-3">
                <p className="font-medium text-foreground">{recipient?.full_name || "Unknown user"}</p>
                <p className="text-sm text-muted-foreground">{format(new Date(invoice.created_at), "MMM d, yyyy")}</p>
                <p className="font-semibold mt-1">{formatCurrency(invoice.amount)}</p>
                {invoice.description && <p className="text-sm text-muted-foreground mt-1">{invoice.description}</p>}
                {invoice.due_date && <p className="text-sm text-muted-foreground mt-1">Due: {invoice.due_date}</p>}
                <p className="text-sm mt-1 capitalize">Status: {invoice.status}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SendInvoice;
