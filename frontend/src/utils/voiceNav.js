// Simple voice/text navigation. Only short, exact navigation phrases match, so a request like
// "show payments from Asha" is still sent to the assistant instead of navigating away.

const FILLER = new Set([
  'open', 'go', 'to', 'the', 'show', 'me', 'my', 'take', 'page', 'screen', 'please', 'view', 'see',
  'खोलो', 'खोलें', 'खोलिए', 'जाओ', 'जाएं', 'पर', 'दिखाओ', 'दिखाइए', 'मेरा', 'मेरे', 'पेज',
  'திற', 'திறக்கவும்', 'செல்', 'செல்லவும்', 'காட்டு', 'காட்டவும்', 'எனது', 'பக்கம்',
]);

const ROUTES = [
  { path: '/app', words: ['dashboard', 'home', 'overview'], stems: ['डैशबोर्ड', 'होम', 'டாஷ்போர்டு', 'முகப்பு'] },
  { path: '/app/assistant', words: ['assistant', 'ai assistant'], stems: ['असिस्टेंट', 'सहायक', 'உதவியாளர்'] },
  { path: '/app/payments', words: ['payments', 'payment'], stems: ['भुगतान', 'கட்டணங்கள்', 'கட்டணம்', 'பணம் செலுத்து'] },
  { path: '/app/invoices', words: ['invoices', 'invoice', 'bills'], stems: ['चालान', 'इनवॉइस', 'விலைப்பட்டியல்', 'இன்வாய்ஸ்'] },
  { path: '/app/customers', words: ['customers', 'customer', 'clients'], stems: ['ग्राहक', 'வாடிக்கையாளர்'] },
  { path: '/app/insights', words: ['insights', 'analytics'], stems: ['इनसाइट', 'अंतर्दृष्टि', 'நுண்ணறிவு', 'இன்சைட்'] },
  { path: '/app/safety', words: ['safety', 'alerts', 'security'], stems: ['सुरक्षा', 'अलर्ट', 'பாதுகாப்பு', 'எச்சரிக்கை'] },
  { path: '/app/reports', words: ['reports', 'report'], stems: ['रिपोर्ट', 'அறிக்கை'] },
  { path: '/app/settings', words: ['settings', 'setting', 'profile'], stems: ['सेटिंग', 'அமைப்பு'] },
];

export function matchNavigation(text) {
  if (!text) return null;
  const cleaned = String(text)
    .toLowerCase()
    .replace(/[.,!?।]/g, ' ')
    .trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 5) return null;
  const rest = tokens.filter((tk) => !FILLER.has(tk));
  if (rest.length === 0) return null;
  const joined = rest.join(' ');
  for (const route of ROUTES) {
    if (route.words.includes(joined)) return route.path;
    if (route.stems.some((s) => joined.startsWith(s) && joined.length <= s.length + 6)) return route.path;
  }
  return null;
}
