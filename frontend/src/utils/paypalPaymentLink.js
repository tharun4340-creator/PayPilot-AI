/** Accept only secure links hosted on PayPal's own domains. */
export function validatePayPalPaymentLink(value) {
  const input = typeof value === 'string' ? value.trim() : '';
  if (!input) return { error: 'required' };

  let url;
  try {
    url = new URL(input);
  } catch {
    return { error: 'invalid' };
  }

  const host = url.hostname.toLowerCase();
  const paypalDomain = host === 'paypal.com' || host.endsWith('.paypal.com') || host === 'paypal.me';
  if (url.protocol !== 'https:' || !paypalDomain || url.username || url.password || url.port) {
    return { error: 'invalid' };
  }

  return { href: url.href, host };
}
