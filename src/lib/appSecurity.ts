export interface AppSecuritySettings {
  pinHash?: string;
  passwordHash?: string;
  biometricEnabled?: boolean;
  biometricCredentialId?: string;
}

const securityKey = (userId: string) => `openpay_security_${userId}`;
const unlockKey = (userId: string) => `openpay_security_unlocked_${userId}`;

const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const fromBase64 = (base64url: string): Uint8Array => {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export const loadAppSecuritySettings = (userId: string): AppSecuritySettings => {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(securityKey(userId));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as AppSecuritySettings;
  } catch {
    return {};
  }
};

export const saveAppSecuritySettings = (userId: string, settings: AppSecuritySettings) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(securityKey(userId), JSON.stringify(settings));
};

export const clearAppSecurityUnlock = (userId: string) => {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(unlockKey(userId));
};

export const markAppSecurityUnlocked = (userId: string) => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(unlockKey(userId), "1");
};

export const isAppSecurityUnlocked = (userId: string) => {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(unlockKey(userId)) === "1";
};

export const hasAnyAppSecurityMethod = (settings: AppSecuritySettings) =>
  Boolean(settings.pinHash || settings.passwordHash || (settings.biometricEnabled && settings.biometricCredentialId));

export const hashSecret = async (value: string): Promise<string> => {
  const normalized = value.trim();
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const isBiometricSupported = () =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  "PublicKeyCredential" in window &&
  !!navigator.credentials;

export const registerBiometricCredential = async (userId: string, displayName: string): Promise<string> => {
  if (!isBiometricSupported()) throw new Error("Biometric authentication is not supported on this device.");

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userBytes = new TextEncoder().encode(userId.slice(0, 64));
  const creationOptions: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: "OpenPay",
      id: window.location.hostname,
    },
    user: {
      id: userBytes,
      name: `${userId}@openpay.local`,
      displayName,
    },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    timeout: 60_000,
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "preferred",
    },
    attestation: "none",
  };

  const credential = (await navigator.credentials.create({
    publicKey: creationOptions,
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error("Could not register biometric credential.");
  const rawId = new Uint8Array(credential.rawId);
  return toBase64(rawId);
};

export const verifyBiometricCredential = async (credentialId: string) => {
  if (!isBiometricSupported()) throw new Error("Biometric authentication is not supported on this device.");

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const idBytes = fromBase64(credentialId);

  const requestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    timeout: 60_000,
    userVerification: "required",
    allowCredentials: [{ type: "public-key", id: idBytes }],
  };

  const assertion = await navigator.credentials.get({
    publicKey: requestOptions,
  });

  if (!assertion) throw new Error("Biometric verification failed.");
};
