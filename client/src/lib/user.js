export const getPublicUserName = (user) =>
  user?.displayName?.trim() || user?.name?.trim() || 'Learner';

export const isGoogleUser = (user) => user?.authProvider === 'google';

export const isAdminUser = (user) => user?.role === 'admin';

export const isGuestLikeUser = (user) =>
  user?.authProvider === 'guest' || user?.authProvider === 'demo';

export const ensureGuestCode = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  const existingGuestCode = window.localStorage.getItem('guest-code');
  if (existingGuestCode) {
    return existingGuestCode;
  }

  const guestCode = window.crypto?.randomUUID?.() || `${Date.now()}`;
  window.localStorage.setItem('guest-code', guestCode);
  return guestCode;
};
