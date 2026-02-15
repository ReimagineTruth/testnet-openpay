import { createContext, useContext, useState, ReactNode } from "react";

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  flag: string;
  rate: number; // rate relative to USD
}

export const currencies: Currency[] = [
  { code: "PI", symbol: "π", name: "Pi", flag: "PI", rate: 1 },
  { code: "USD", symbol: "$", name: "US Dollar", flag: "\u{1F1FA}\u{1F1F8}", rate: 1 },
  { code: "EUR", symbol: "\u20AC", name: "Euro", flag: "\u{1F1EA}\u{1F1FA}", rate: 0.92 },
  { code: "GBP", symbol: "\u00A3", name: "British Pound", flag: "\u{1F1EC}\u{1F1E7}", rate: 0.79 },
  { code: "JPY", symbol: "\u00A5", name: "Japanese Yen", flag: "\u{1F1EF}\u{1F1F5}", rate: 149.5 },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar", flag: "\u{1F1E8}\u{1F1E6}", rate: 1.36 },
  { code: "AUD", symbol: "A$", name: "Australian Dollar", flag: "\u{1F1E6}\u{1F1FA}", rate: 1.53 },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc", flag: "\u{1F1E8}\u{1F1ED}", rate: 0.88 },
  { code: "CNY", symbol: "\u00A5", name: "Chinese Yuan", flag: "\u{1F1E8}\u{1F1F3}", rate: 7.24 },
  { code: "INR", symbol: "\u20B9", name: "Indian Rupee", flag: "\u{1F1EE}\u{1F1F3}", rate: 83.1 },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso", flag: "\u{1F1F2}\u{1F1FD}", rate: 17.15 },
  { code: "BRL", symbol: "R$", name: "Brazilian Real", flag: "\u{1F1E7}\u{1F1F7}", rate: 4.97 },
  { code: "KRW", symbol: "\u20A9", name: "South Korean Won", flag: "\u{1F1F0}\u{1F1F7}", rate: 1325 },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar", flag: "\u{1F1F8}\u{1F1EC}", rate: 1.34 },
  { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", flag: "\u{1F1ED}\u{1F1F0}", rate: 7.82 },
  { code: "SEK", symbol: "kr", name: "Swedish Krona", flag: "\u{1F1F8}\u{1F1EA}", rate: 10.45 },
  { code: "NOK", symbol: "kr", name: "Norwegian Krone", flag: "\u{1F1F3}\u{1F1F4}", rate: 10.55 },
  { code: "DKK", symbol: "kr", name: "Danish Krone", flag: "\u{1F1E9}\u{1F1F0}", rate: 6.87 },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", flag: "\u{1F1F3}\u{1F1FF}", rate: 1.63 },
  { code: "ZAR", symbol: "R", name: "South African Rand", flag: "\u{1F1FF}\u{1F1E6}", rate: 18.6 },
  { code: "TRY", symbol: "\u20BA", name: "Turkish Lira", flag: "\u{1F1F9}\u{1F1F7}", rate: 30.2 },
  { code: "AED", symbol: "\u062F.\u0625", name: "UAE Dirham", flag: "\u{1F1E6}\u{1F1EA}", rate: 3.67 },
  { code: "SAR", symbol: "\uFDFC", name: "Saudi Riyal", flag: "\u{1F1F8}\u{1F1E6}", rate: 3.75 },
  { code: "PLN", symbol: "z\u0142", name: "Polish Zloty", flag: "\u{1F1F5}\u{1F1F1}", rate: 3.98 },
  { code: "THB", symbol: "\u0E3F", name: "Thai Baht", flag: "\u{1F1F9}\u{1F1ED}", rate: 35.2 },
  { code: "PHP", symbol: "\u20B1", name: "Philippine Peso", flag: "\u{1F1F5}\u{1F1ED}", rate: 55.8 },
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", flag: "\u{1F1EE}\u{1F1E9}", rate: 15650 },
  { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", flag: "\u{1F1F2}\u{1F1FE}", rate: 4.65 },
  { code: "CZK", symbol: "K\u010D", name: "Czech Koruna", flag: "\u{1F1E8}\u{1F1FF}", rate: 22.8 },
  { code: "CLP", symbol: "CL$", name: "Chilean Peso", flag: "\u{1F1E8}\u{1F1F1}", rate: 880 },
  { code: "NGN", symbol: "\u20A6", name: "Nigerian Naira", flag: "\u{1F1F3}\u{1F1EC}", rate: 1550 },
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


