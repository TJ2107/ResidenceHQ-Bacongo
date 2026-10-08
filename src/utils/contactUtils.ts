// Phone & WhatsApp Communication Helpers for Brazzaville Express

/**
 * Cleans phone number by removing all spaces, dashes, dots, and parentheses.
 */
export function sanitizePhoneNumber(phone: string): string {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
}

/**
 * Formats a phone number for international WhatsApp link (https://wa.me/<number>).
 * Defaults to Republic of the Congo prefix (+242) if not present.
 */
export function getWhatsAppLink(phone: string, message?: string): string {
  let cleaned = sanitizePhoneNumber(phone);
  if (!cleaned) return '#';

  // If starts with +, remove + for wa.me
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0')) {
    // Local Congolese format e.g. 06 123 45 67 or 05 555 12 34 -> 24206... or 24205...
    cleaned = `242${cleaned}`;
  } else if (!cleaned.startsWith('242') && cleaned.length <= 9) {
    // Prepend 242 if 9 digits or shorter
    cleaned = `242${cleaned}`;
  }

  const encodedText = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${cleaned}${encodedText}`;
}

/**
 * Formats a phone number for direct tel: URI.
 */
export function getDirectTelLink(phone: string): string {
  const cleaned = sanitizePhoneNumber(phone);
  if (!cleaned) return '#';
  return `tel:${cleaned}`;
}

/**
 * Returns a nicely formatted phone display string (e.g. +242 06 123 45 67).
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return 'Non renseigné';
  return phone.trim();
}
