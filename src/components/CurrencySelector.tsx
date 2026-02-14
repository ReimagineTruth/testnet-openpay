import { useState } from "react";
import { currencies, useCurrency } from "@/contexts/CurrencyContext";
import { ChevronDown, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const CurrencySelector = () => {
  const { currency, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = currencies.filter(
    (c) =>
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium border border-border hover:bg-accent transition-colors">
          <span className="text-lg leading-none">{currency.flag}</span>
          <span>{currency.code}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-lg font-bold text-foreground">Select Currency</DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search currency..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl"
            />
          </div>
        </div>
        <ScrollArea className="h-[360px]">
          <div className="px-2 pb-2">
            {filtered.map((c) => (
              <button
                key={c.code}
                onClick={() => {
                  setCurrency(c);
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  c.code === currency.code
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted text-foreground"
                }`}
              >
                <span className="text-2xl leading-none">{c.flag}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{c.code}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.name}</p>
                </div>
                <span className="text-xs text-muted-foreground font-medium">{c.symbol}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">No currencies found</p>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default CurrencySelector;
