const normalizeUsername = (value: string | null | undefined) =>
  (value || "").trim().toLowerCase().replace(/^@+/, "");

const parseCsvEnv = (value: string | undefined, fallback: string[]) => {
  const parsed = (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
};

const allowedUsernames = parseCsvEnv(
  import.meta.env.VITE_REMITTANCE_DEV_USERNAMES,
  ["mrwainfoundation", "mrwain"],
).map((item) => item.toLowerCase());

const allowedUserIds = parseCsvEnv(
  import.meta.env.VITE_REMITTANCE_DEV_USER_IDS,
  [],
);

export const canAccessRemittanceMerchant = (userId: string | null | undefined, username: string | null | undefined) => {
  const normalized = normalizeUsername(username);
  if (userId && allowedUserIds.includes(userId)) return true;
  if (normalized && allowedUsernames.includes(normalized)) return true;
  return false;
};
