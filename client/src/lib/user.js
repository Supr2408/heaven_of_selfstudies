export const getPublicUserName = (user) =>
  user?.displayName?.trim() || user?.name?.trim() || 'Learner';

export const isGoogleUser = (user) => user?.authProvider === 'google';

export const isAdminUser = (user) => user?.role === 'admin';

export const isGuestLikeUser = (user) =>
  user?.authProvider === 'guest' || user?.authProvider === 'demo';

export const GUEST_ACCESS_LIMIT_MS = 5 * 60 * 1000;

const GUEST_CODE_KEY = 'guest-code';
const GUEST_SESSION_STARTED_AT_KEY = 'guest-session-started-at';
const GUEST_GOOGLE_REQUIRED_KEY = 'guest-google-required';

const readStoredNumber = (key) => {
  if (typeof window === 'undefined') {
    return 0;
  }

  const rawValue = window.localStorage.getItem(key);
  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
};

export const ensureGuestCode = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  const existingGuestCode = window.localStorage.getItem(GUEST_CODE_KEY);
  if (existingGuestCode) {
    return existingGuestCode;
  }

  const guestCode = window.crypto?.randomUUID?.() || `${Date.now()}`;
  window.localStorage.setItem(GUEST_CODE_KEY, guestCode);
  return guestCode;
};

export const getGuestCode = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.localStorage.getItem(GUEST_CODE_KEY) || '';
};

export const getClientIdentityKey = () => {
  const guestCode = ensureGuestCode();
  return guestCode ? `guest:${guestCode}` : '';
};

export const markGuestSessionStarted = (startedAt = Date.now()) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(GUEST_SESSION_STARTED_AT_KEY, `${startedAt}`);
  window.localStorage.removeItem(GUEST_GOOGLE_REQUIRED_KEY);
};

export const requireGoogleAfterGuestSession = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(GUEST_GOOGLE_REQUIRED_KEY, '1');
  window.localStorage.removeItem(GUEST_SESSION_STARTED_AT_KEY);
};

export const clearGuestSessionRequirement = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(GUEST_GOOGLE_REQUIRED_KEY);
  window.localStorage.removeItem(GUEST_SESSION_STARTED_AT_KEY);
};

export const isGoogleSignInRequiredAfterGuest = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(GUEST_GOOGLE_REQUIRED_KEY) === '1';
};

export const getGuestSessionStartedAt = () => readStoredNumber(GUEST_SESSION_STARTED_AT_KEY);

export const getRemainingGuestAccessMs = () => {
  const startedAt = getGuestSessionStartedAt();
  if (!startedAt) {
    return GUEST_ACCESS_LIMIT_MS;
  }

  return Math.max(GUEST_ACCESS_LIMIT_MS - (Date.now() - startedAt), 0);
};

export const hasGuestAccessExpired = () =>
  isGoogleSignInRequiredAfterGuest() || getRemainingGuestAccessMs() <= 0;
