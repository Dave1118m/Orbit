export const ETHIOPIAN_BANKS = [
  // Major State-Owned & Central Banks
  { label: 'Commercial Bank of Ethiopia (CBE)', value: 'Commercial Bank of Ethiopia (CBE)' },
  { label: 'Development Bank of Ethiopia (DBE)', value: 'Development Bank of Ethiopia (DBE)' },
  { label: 'National Bank of Ethiopia (NBE)', value: 'National Bank of Ethiopia (NBE)' },

  // Private Commercial Banks
  { label: 'Abay Bank', value: 'Abay Bank' },
  { label: 'Addis International Bank', value: 'Addis International Bank' },
  { label: 'Ahadu Bank', value: 'Ahadu Bank' },
  { label: 'Amhara Bank', value: 'Amhara Bank' },
  { label: 'Awash International Bank', value: 'Awash International Bank' },
  { label: 'Bank of Abyssinia', value: 'Bank of Abyssinia' },
  { label: 'Berhan Bank', value: 'Berhan Bank' },
  { label: 'Buna International Bank', value: 'Buna International Bank' },
  { label: 'Cooperative Bank of Oromia (Coopbank)', value: 'Cooperative Bank of Oromia (Coopbank)' },
  { label: 'Dashen Bank', value: 'Dashen Bank' },
  { label: 'Enat Bank', value: 'Enat Bank' },
  { label: 'Gadaa Bank', value: 'Gadaa Bank' },
  { label: 'Global Bank Ethiopia', value: 'Global Bank Ethiopia' },
  { label: 'Goh Betoch Bank (Mortgage Bank)', value: 'Goh Betoch Bank (Mortgage Bank)' },
  { label: 'Hibret Bank (United Bank)', value: 'Hibret Bank (United Bank)' },
  { label: 'Lion International Bank', value: 'Lion International Bank' },
  { label: 'Nib International Bank', value: 'Nib International Bank' },
  { label: 'Oromia Bank (OIB)', value: 'Oromia Bank (OIB)' },
  { label: 'Tsehay Bank', value: 'Tsehay Bank' },
  { label: 'Wegagen Bank', value: 'Wegagen Bank' },
  { label: 'Zemen Bank', value: 'Zemen Bank' },

  // Full-Fledged Interest-Free (Islamic) Banks
  { label: 'Hijra Bank', value: 'Hijra Bank' },
  { label: 'Ramis Bank (Rammis Bank)', value: 'Ramis Bank (Rammis Bank)' },
  { label: 'ZamZam Bank', value: 'ZamZam Bank' },

  // Converted Regional Commercial Banks
  { label: 'Omo Bank', value: 'Omo Bank' },
  { label: 'Shabelle Bank', value: 'Shabelle Bank' },
  { label: 'Sidama Bank', value: 'Sidama Bank' },
  { label: 'Siinqee Bank', value: 'Siinqee Bank' },
  { label: 'Tsedey Bank', value: 'Tsedey Bank' },

  // International / Foreign Partner Account
  { label: 'Other / International Bank', value: 'Other / International Bank' }
];

/**
 * Returns clean, compact short form of a bank name (e.g. CBE, Coopbank, Abyssinia, Dashen)
 * to avoid layout wrapping and text misalignment in tables, cards, and select dropdowns.
 * @param {string} name 
 * @returns {string} Short name
 */
export function getShortBankName(name) {
  if (!name) return '';
  const lower = name.toLowerCase();
  if (lower.includes('commercial bank of ethiopia') || lower.includes('cbe')) return 'CBE';
  if (lower.includes('development bank') || lower.includes('dbe')) return 'DBE';
  if (lower.includes('national bank of ethiopia') || lower.includes('nbe')) return 'NBE';
  if (lower.includes('cooperative bank') || lower.includes('coopbank')) return 'Coopbank';
  if (lower.includes('abyssinia')) return 'Abyssinia';
  if (lower.includes('awash')) return 'Awash Bank';
  if (lower.includes('dashen')) return 'Dashen';
  if (lower.includes('wegagen')) return 'Wegagen';
  if (lower.includes('hibret') || lower.includes('united bank')) return 'Hibret Bank';
  if (lower.includes('nib')) return 'Nib Bank';
  if (lower.includes('lion')) return 'Lion Bank';
  if (lower.includes('zemen')) return 'Zemen';
  if (lower.includes('oromia')) return 'Oromia Bank';
  if (lower.includes('buna')) return 'Buna Bank';
  if (lower.includes('berhan')) return 'Berhan';
  if (lower.includes('abay')) return 'Abay';
  if (lower.includes('addis international') || lower.includes('addis bank')) return 'Addis Bank';
  if (lower.includes('global bank')) return 'Global Bank';
  if (lower.includes('enat')) return 'Enat';
  if (lower.includes('amhara')) return 'Amhara Bank';
  if (lower.includes('goh betoch')) return 'Goh Betoch';
  if (lower.includes('tsehay')) return 'Tsehay';
  if (lower.includes('ahadu')) return 'Ahadu';
  if (lower.includes('siinqee')) return 'Siinqee';
  if (lower.includes('shabelle')) return 'Shabelle';
  if (lower.includes('tsedey')) return 'Tsedey';
  if (lower.includes('sidama')) return 'Sidama';
  if (lower.includes('omo')) return 'Omo Bank';
  if (lower.includes('gadaa')) return 'Gadaa';
  if (lower.includes('zamzam')) return 'ZamZam';
  if (lower.includes('hijra')) return 'Hijra';
  if (lower.includes('ramis') || lower.includes('rammis')) return 'Ramis Bank';
  if (lower.includes('other') || lower.includes('international')) return 'Other Bank';

  // If name has a parenthetical acronym like "XYZ Bank (XYZ)", extract it
  const match = name.match(/\(([^)]+)\)/);
  if (match && match[1] && match[1].length <= 8) return match[1];

  return name;
}
