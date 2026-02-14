import { createContext, useContext, useState, ReactNode } from "react";

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  flag: string;
  rate: number; // rate relative to USD
}

export const currencies: Currency[] = [
  { code: "USD", symbol: "$", name: "US Dollar", flag: "🇺🇸", rate: 1 },
  { code: "EUR", symbol: "€", name: "Euro", flag: "🇪🇺", rate: 0.92 },
  { code: "GBP", symbol: "£", name: "British Pound", flag: "🇬🇧", rate: 0.79 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", flag: "🇯🇵", rate: 149.5 },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", flag: "🇨🇦", rate: 1.36 },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", flag: "🇦🇺", rate: 1.53 },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc", flag: "🇨🇭", rate: 0.88 },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", flag: "🇨🇳", rate: 7.24 },
  { code: "INR", symbol: "₹", name: "Indian Rupee", flag: "🇮🇳", rate: 83.1 },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso", flag: "🇲🇽", rate: 17.15 },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", flag: "🇧🇷", rate: 4.97 },
  { code: "KRW", symbol: "₩", name: "South Korean Won", flag: "🇰🇷", rate: 1325 },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", flag: "🇸🇬", rate: 1.34 },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", flag: "🇭🇰", rate: 7.82 },
  { code: "SEK", symbol: "kr", name: "Swedish Krona", flag: "🇸🇪", rate: 10.45 },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone", flag: "🇳🇴", rate: 10.55 },
  { code: "DKK", symbol: "kr", name: "Danish Krone", flag: "🇩🇰", rate: 6.87 },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", flag: "🇳🇿", rate: 1.63 },
  { code: "ZAR", symbol: "R", name: "South African Rand", flag: "🇿🇦", rate: 18.6 },
  { code: "TRY", symbol: "₺", name: "Turkish Lira", flag: "🇹🇷", rate: 30.2 },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham", flag: "🇦🇪", rate: 3.67 },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal", flag: "🇸🇦", rate: 3.75 },
  { code: "PLN", symbol: "zł", name: "Polish Zloty", flag: "🇵🇱", rate: 3.98 },
  { code: "THB", symbol: "฿", name: "Thai Baht", flag: "🇹🇭", rate: 35.2 },
  { code: "PHP", symbol: "₱", name: "Philippine Peso", flag: "🇵🇭", rate: 55.8 },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", flag: "🇮🇩", rate: 15650 },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", flag: "🇲🇾", rate: 4.65 },
  { code: "CZK", symbol: "Kč", name: "Czech Koruna", flag: "🇨🇿", rate: 22.8 },
  { code: "CLP", symbol: "CL$", name: "Chilean Peso", flag: "🇨🇱", rate: 880 },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira", flag: "🇳🇬", rate: 1550 },
];

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  convert: (usdAmount: number) => number;
  format: (usdAmount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: currencies[0],
  setCurrency: () => {},
  convert: (a) => a,
  format: (a) => `$${a.toFixed(2)}`,
});

export const useCurrency = () => useContext(CurrencyContext);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrency] = useState<Currency>(currencies[0]);

  const convert = (usdAmount: number) => usdAmount * currency.rate;

  const format = (usdAmount: number) => {
    const converted = convert(usdAmount);
    return `${currency.symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, convert, format }}>
      {children}
    </CurrencyContext.Provider>
  );
};
