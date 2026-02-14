type PiPaymentData = {
  amount: number;
  memo: string;
  metadata?: Record<string, unknown>;
};

type PiPaymentCallbacks = {
  onReadyForServerApproval: (paymentId: string) => void | Promise<void>;
  onReadyForServerCompletion: (paymentId: string, txid: string) => void | Promise<void>;
  onCancel: (paymentId?: string) => void;
  onError: (error: { message?: string } | Error) => void;
};

type PiUser = {
  uid: string;
  username: string;
};

type PiAuthResult = {
  user: PiUser;
  accessToken: string;
};

type PiAdsApi = {
  isAdReady?: (adType: "interstitial" | "rewarded") => Promise<boolean>;
  requestAd?: (adType: "interstitial" | "rewarded") => Promise<void>;
  showAd?: (adType: "interstitial" | "rewarded") => Promise<void>;
};

type PiSdk = {
  init: (options: { version: string; sandbox?: boolean }) => void;
  authenticate: (
    scopes: string[],
    onIncompletePaymentFound?: (payment: { identifier: string; txid?: string }) => void,
  ) => Promise<PiAuthResult>;
  createPayment: (payment: PiPaymentData, callbacks: PiPaymentCallbacks) => void;
  openShareDialog?: (title: string, message: string) => void;
  Ads?: PiAdsApi;
};

interface Window {
  Pi?: PiSdk;
}
