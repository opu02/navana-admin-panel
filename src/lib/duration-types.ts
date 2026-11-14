// Duration types — exactly the same values as the app (AppHelper.getDurationCode)
export const DURATION_TYPES = [
  { code: "D", desc: "দিন - Day" },
  { code: "W", desc: "সপ্তাহ - Week" },
  { code: "M", desc: "মাস - Month" },
] as const;
export type DurationCode = (typeof DURATION_TYPES)[number]["code"];

const BN = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
export const toBanglaNumber = (s: string) => s.replace(/[0-9]/g, (d) => BN[Number(d)]);

/** Same as the app: "7" + "দিন - Day" → "৭ দিন" */
export function durationName(num: string, code: string) {
  const t = DURATION_TYPES.find((x) => x.code === code);
  const n = toBanglaNumber(num.trim());
  return t ? `${n} ${t.desc.split(" - ")[0]}` : n;
}

export type DurationItem = {
  id: string;
  name: string;
  number: number | null;
  type: string;
  typeDesc: string;
  isActive: boolean;
  isSystem: boolean;
  createdBy: number | null;
  createdAt: string;
};
export type DurationListResponse = { items: DurationItem[]; total: number; page: number; pageSize: number };
