import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

const HelpCenter = () => {
  const navigate = useNavigate();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const faqs = [
    {
      q: "Why did my payment fail?",
      a: "Most failures happen due to insufficient balance or an expired session. Sign in again and retry.",
    },
    {
      q: "How do I cancel a payment request?",
      a: "Open Request Money and reject pending incoming requests. Sent requests update when paid or rejected.",
    },
    {
      q: "How do I pay an invoice?",
      a: "Open Send Invoice, find the invoice in Received invoices, and tap Pay Invoice.",
    },
  ];

  const loadTickets = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/signin");
      return;
    }
    setUserId(user.id);

    const { data } = await supabase
      .from("support_tickets")
      .select("id, subject, message, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setTickets(data || []);
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleSubmitTicket = async () => {
    if (!userId) return;
    if (!subject.trim() || !message.trim()) {
      toast.error("Subject and message are required");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: userId,
      subject: subject.trim(),
      message: message.trim(),
      status: "open",
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Ticket submitted");
    setSubject("");
    setMessage("");
    await loadTickets();
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="flex items-center gap-3 px-4 pt-4 mb-4">
        <button onClick={() => navigate("/menu")}>
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground">Help Center</h1>
      </div>

      <div className="px-4 space-y-4">
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-foreground">FAQs</h2>
          {faqs.map((faq) => (
            <div key={faq.q} className="border border-border rounded-xl p-3">
              <p className="font-medium text-foreground">{faq.q}</p>
              <p className="text-sm text-muted-foreground mt-1">{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Contact support</h2>
          <Input
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <Textarea
            placeholder="Describe your issue"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Button onClick={handleSubmitTicket} disabled={loading} className="w-full">
            {loading ? "Submitting..." : "Submit Ticket"}
          </Button>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h2 className="font-semibold text-foreground">My tickets</h2>
          {tickets.length === 0 && <p className="text-sm text-muted-foreground">No tickets yet</p>}
          {tickets.map((ticket) => (
            <div key={ticket.id} className="border border-border rounded-xl p-3">
              <p className="font-medium text-foreground">{ticket.subject}</p>
              <p className="text-sm text-muted-foreground mt-1">{ticket.message}</p>
              <p className="text-sm text-muted-foreground mt-2">{format(new Date(ticket.created_at), "MMM d, yyyy")}</p>
              <p className="text-sm mt-1 capitalize">Status: {ticket.status.replace("_", " ")}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;
