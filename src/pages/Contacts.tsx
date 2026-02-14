import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { Search, UserPlus, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Contact {
  id: string;
  contact_id: string;
  full_name: string;
  username: string | null;
}

const Contacts = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const navigate = useNavigate();

  const loadContacts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/signin"); return; }

    const { data } = await supabase
      .from("contacts")
      .select("id, contact_id")
      .eq("user_id", user.id);

    if (data) {
      const enriched = await Promise.all(data.map(async (c) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, username")
          .eq("id", c.contact_id)
          .single();
        return { ...c, full_name: profile?.full_name || "Unknown", username: profile?.username || null };
      }));
      setContacts(enriched);
    }
  };

  useEffect(() => { loadContacts(); }, []);

  const handleAddContact = async () => {
    if (!addEmail.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Find user by email - search profiles with username or look up by matching
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, username");

    // We need to find by email through auth, but since we can't query auth from client,
    // let's search by username
    const found = profiles?.find(p => p.username === addEmail.trim() || p.full_name === addEmail.trim());
    if (!found) {
      toast.error("User not found. Try their username.");
      return;
    }
    if (found.id === user.id) {
      toast.error("Cannot add yourself");
      return;
    }

    const { error } = await supabase
      .from("contacts")
      .insert({ user_id: user.id, contact_id: found.id });

    if (error) {
      if (error.code === "23505") toast.error("Already in contacts");
      else toast.error(error.message);
    } else {
      toast.success("Contact added!");
      setShowAdd(false);
      setAddEmail("");
      loadContacts();
    }
  };

  const filtered = contacts.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.username && c.username.toLowerCase().includes(search.toLowerCase()))
  );

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").slice(0, 3).toUpperCase();
  };

  const colors = ["bg-paypal-dark", "bg-paypal-light-blue", "bg-primary", "bg-muted-foreground"];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="px-4 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-foreground">Contacts</h1>
          <button onClick={() => setShowAdd(true)} className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-paypal-light-blue" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Name, username, email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-12 rounded-xl bg-card"
            />
          </div>
        </div>

        <div className="space-y-1">
          {filtered.map((contact, i) => (
            <button
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              className="w-full flex items-center gap-3 py-4 px-2 hover:bg-muted rounded-xl transition"
            >
              <div className={`w-12 h-12 rounded-full ${colors[i % colors.length]} flex items-center justify-center`}>
                <span className="text-sm font-bold text-primary-foreground">{getInitials(contact.full_name)}</span>
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">{contact.full_name}</p>
                {contact.username && <p className="text-sm text-muted-foreground">@{contact.username}</p>}
              </div>
              <Info className="w-5 h-5 text-muted-foreground ml-auto" />
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No contacts yet</p>
          )}
        </div>
      </div>

      {/* Add Contact Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="rounded-2xl">
          <h2 className="text-xl font-bold mb-4">Add Contact</h2>
          <Input
            placeholder="Enter username"
            value={addEmail}
            onChange={(e) => setAddEmail(e.target.value)}
            className="h-12 rounded-xl mb-4"
          />
          <Button onClick={handleAddContact} className="w-full h-12 rounded-xl">Add</Button>
        </DialogContent>
      </Dialog>

      {/* Contact Detail Sheet */}
      <Dialog open={!!selectedContact} onOpenChange={() => setSelectedContact(null)}>
        <DialogContent className="rounded-t-2xl">
          {selectedContact && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-paypal-dark mx-auto flex items-center justify-center mb-3">
                <span className="text-lg font-bold text-primary-foreground">{getInitials(selectedContact.full_name)}</span>
              </div>
              <h3 className="text-xl font-bold">{selectedContact.full_name}</h3>
              {selectedContact.username && <p className="text-muted-foreground">@{selectedContact.username}</p>}
              <Button
                onClick={() => { setSelectedContact(null); navigate(`/send?to=${selectedContact.contact_id}`); }}
                className="w-full h-12 rounded-xl mt-6"
              >
                Send Money
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav active="contacts" />
    </div>
  );
};

export default Contacts;
