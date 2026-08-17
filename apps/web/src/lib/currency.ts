import { CURRENCIES, DEFAULT_CURRENCY, type Currency } from "@kaizenlife/shared";

export { DEFAULT_CURRENCY };
export type { Currency };

const LOCALES: Record<Currency, string> = {
  idr: "id-ID",
  usd: "en-US",
  eur: "en-IE",
  sgd: "en-SG",
  myr: "ms-MY",
  jpy: "ja-JP",
};

export const CURRENCY_LABELS: Record<Currency, string> = {
  idr: "IDR - Rupiah",
  usd: "USD - Dollar",
  eur: "EUR - Euro",
  sgd: "SGD - Dollar Singapura",
  myr: "MYR - Ringgit",
  jpy: "JPY - Yen",
};

export const CURRENCY_OPTIONS = CURRENCIES.map((code) => ({
  value: code,
  label: CURRENCY_LABELS[code],
}));

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

export function formatCents(cents: number, currency: Currency = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat(LOCALES[currency], {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatCentsCompact(
  cents: number,
  currency: Currency = DEFAULT_CURRENCY,
): string {
  return new Intl.NumberFormat(LOCALES[currency], {
    style: "currency",
    currency: currency.toUpperCase(),
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / 100);
}
