import { useNavigate } from "react-router-dom";
import { ArrowLeft, Store, Utensils, Shirt, Briefcase, Smartphone, HandCoins } from "lucide-react";

const OpenPayGuidePage = () => {
  const navigate = useNavigate();

  const categories = [
    {
      icon: Utensils,
      title: "Restaurants and Cafes",
      examples: "Coffee shops, family restaurants, food stalls, bakeries.",
      idea: "Accept instant OpenPay checkout for dine-in, takeout, and delivery pickup.",
    },
    {
      icon: Shirt,
      title: "Retail and Clothing",
      examples: "Fashion stores, shoe shops, beauty stores, accessories.",
      idea: "Use OpenPay at checkout counter and in social-commerce live selling.",
    },
    {
      icon: Briefcase,
      title: "Services and Freelancers",
      examples: "Designers, developers, tutors, salon/barber services, mechanics.",
      idea: "Share payment QR or request links for fast same-day settlement.",
    },
    {
      icon: Smartphone,
      title: "Digital Goods",
      examples: "Courses, templates, subscriptions, game items, creator products.",
      idea: "Receive stable Pi value for recurring digital sales.",
    },
    {
      icon: Store,
      title: "Community Businesses",
      examples: "Local Pi merchants, weekend markets, home businesses.",
      idea: "Build trust with transparent payment records and receipt history.",
    },
  ];

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-10">
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate("/menu")}
          className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-paypal-dark">Where to Use OpenPay</h1>
      </div>

      <div className="rounded-3xl border border-white/30 bg-gradient-to-br from-paypal-blue to-[#0073e6] p-5 text-white shadow-xl shadow-[#004bba]/20">
        <div className="flex items-center gap-2">
          <HandCoins className="h-5 w-5" />
          <p className="text-sm font-semibold uppercase tracking-wide">Merchant Guide</p>
        </div>
        <p className="mt-2 text-sm text-white/90">
          OpenPay helps Pi community businesses accept stable Pi for daily goods and services like a modern fintech checkout flow.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {categories.map(({ icon: Icon, title, examples, idea }) => (
          <div key={title} className="paypal-surface rounded-3xl p-4">
            <div className="mb-2 flex items-center gap-2">
              <Icon className="h-5 w-5 text-paypal-blue" />
              <h2 className="font-semibold text-foreground">{title}</h2>
            </div>
            <p className="text-sm text-foreground"><span className="font-medium">Examples:</span> {examples}</p>
            <p className="mt-1 text-sm text-muted-foreground">{idea}</p>
          </div>
        ))}
      </div>

      <div className="paypal-surface mt-4 rounded-3xl p-4">
        <h2 className="font-semibold text-foreground">Professional setup checklist</h2>
        <p className="mt-2 text-sm text-muted-foreground">1. Add your business name and logo in Profile.</p>
        <p className="mt-1 text-sm text-muted-foreground">2. Use Receive page QR for checkout counter payments.</p>
        <p className="mt-1 text-sm text-muted-foreground">3. Use Request Money for remote sales and pre-orders.</p>
        <p className="mt-1 text-sm text-muted-foreground">4. Keep transaction notes for clear accounting history.</p>
      </div>
    </div>
  );
};

export default OpenPayGuidePage;
