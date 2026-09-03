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

/**
 * Returns the account number validation specification for a selected bank.
 * @param {string} bankName 
 * @returns {object} Validation rule specification
 */
export function getBankValidationRule(bankName) {
  if (!bankName) {
    return {
      expectedDigits: [8, 9, 10, 11, 12, 13, 14, 15, 16],
      prefix: null,
      placeholder: 'Enter bank account number',
      helpText: 'Enter valid account number',
      validate: (acc) => {
        if (!acc) return 'Account number is required.';
        if (!/^\d+$/.test(acc)) return 'Account number must contain only digits.';
        if (acc.length < 6 || acc.length > 20) return 'Account number must be between 6 and 20 digits.';
        return null;
      }
    };
  }

  const lower = bankName.toLowerCase();

  // 1. Commercial Bank of Ethiopia (CBE)
  if (lower.includes('commercial bank of ethiopia') || lower.includes('cbe')) {
    return {
      expectedDigits: [13],
      prefix: '1000',
      placeholder: '1000123456789 (13 digits)',
      helpText: '13 digits starting with 1000 (e.g. 1000xxxxxxxxx)',
      validate: (acc) => {
        if (!acc) return 'Account number is required.';
        if (!/^\d+$/.test(acc)) return 'CBE account number must contain only digits.';
        if (acc.length !== 13) return `CBE account number must be exactly 13 digits (currently ${acc.length}).`;
        if (!acc.startsWith('1000')) return "CBE account number must start with '1000' (format: 1000xxxxxxxxx).";
        return null;
      }
    };
  }

  // 2. Awash Bank
  if (lower.includes('awash')) {
    return {
      expectedDigits: [14],
      prefix: '01',
      placeholder: '01304123456789 (14 digits)',
      helpText: '14 digits starting with 01 (e.g. 01304xxxxxxxxx)',
      validate: (acc) => {
        if (!acc) return 'Account number is required.';
        if (!/^\d+$/.test(acc)) return 'Awash Bank account number must contain only digits.';
        if (acc.length !== 14) return `Awash Bank account number must be exactly 14 digits (currently ${acc.length}).`;
        if (!acc.startsWith('01')) return "Awash Bank account number must start with '01'.";
        return null;
      }
    };
  }

  // 3. Bank of Abyssinia
  if (lower.includes('abyssinia')) {
    return {
      expectedDigits: [8, 16],
      prefix: null,
      placeholder: '12345678 (8-digit passbook) or 16-digit virtual',
      helpText: '8 digits (passbook / branch) or 16 digits (digital virtual account)',
      validate: (acc) => {
        if (!acc) return 'Account number is required.';
        if (!/^\d+$/.test(acc)) return 'Bank of Abyssinia account number must contain only digits.';
        if (acc.length !== 8 && acc.length !== 16) return `Bank of Abyssinia account number must be 8 or 16 digits (currently ${acc.length}).`;
        return null;
      }
    };
  }

  // 4. Dashen Bank
  if (lower.includes('dashen')) {
    return {
      expectedDigits: [14, 10],
      prefix: null,
      placeholder: '01001234567890 (14 digits) or 10 digits',
      helpText: '14 digits (standard modern) or 10 digits (legacy branch)',
      validate: (acc) => {
        if (!acc) return 'Account number is required.';
        if (!/^\d+$/.test(acc)) return 'Dashen Bank account number must contain only digits.';
        if (acc.length !== 14 && acc.length !== 10) return `Dashen Bank account number must be 14 or 10 digits (currently ${acc.length}).`;
        return null;
      }
    };
  }

  // 5. Cooperative Bank of Oromia (Coopbank)
  if (lower.includes('cooperative bank') || lower.includes('coopbank')) {
    return {
      expectedDigits: [13],
      prefix: '10',
      placeholder: '1000012345678 (13 digits)',
      helpText: '13 digits starting with 10 (e.g. 1000012345678)',
      validate: (acc) => {
        if (!acc) return 'Account number is required.';
        if (!/^\d+$/.test(acc)) return 'Coopbank account number must contain only digits.';
        if (acc.length !== 13) return `Coopbank account number must be exactly 13 digits (currently ${acc.length}).`;
        if (!acc.startsWith('10')) return "Coopbank account number must start with '10'.";
        return null;
      }
    };
  }

  // 6. Hibret Bank (United Bank)
  if (lower.includes('hibret') || lower.includes('united bank')) {
    return {
      expectedDigits: [14, 16],
      prefix: null,
      placeholder: '10123456789012 (14 digits)',
      helpText: '14 digits (or 16 digits for corporate accounts)',
      validate: (acc) => {
        if (!acc) return 'Account number is required.';
        if (!/^\d+$/.test(acc)) return 'Hibret Bank account number must contain only digits.';
        if (acc.length !== 14 && acc.length !== 16) return `Hibret Bank account number must be 14 or 16 digits (currently ${acc.length}).`;
        return null;
      }
    };
  }

  // 7. Nib International Bank
  if (lower.includes('nib')) {
    return {
      expectedDigits: [13, 14],
      prefix: null,
      placeholder: '7001234567890 (13 digits)',
      helpText: '13 digits (or 14 digits depending on branch)',
      validate: (acc) => {
        if (!acc) return 'Account number is required.';
        if (!/^\d+$/.test(acc)) return 'Nib Bank account number must contain only digits.';
        if (acc.length !== 13 && acc.length !== 14) return `Nib Bank account number must be 13 or 14 digits (currently ${acc.length}).`;
        return null;
      }
    };
  }

  // 8. Wegagen Bank
  if (lower.includes('wegagen')) {
    return {
      expectedDigits: [14, 12, 10],
      prefix: null,
      placeholder: '01234567890123 (14 digits)',
      helpText: '14 digits (standard modern) or 10-12 digits (legacy)',
      validate: (acc) => {
        if (!acc) return 'Account number is required.';
        if (!/^\d+$/.test(acc)) return 'Wegagen Bank account number must contain only digits.';
        if (![14, 12, 10].includes(acc.length)) return `Wegagen Bank account number must be 14 digits or 10-12 digits (currently ${acc.length}).`;
        return null;
      }
    };
  }

  // 9. Zemen Bank
  if (lower.includes('zemen')) {
    return {
      expectedDigits: [16],
      prefix: '1000',
      placeholder: '1000001234567890 (16 digits)',
      helpText: '16 digits starting with 1000',
      validate: (acc) => {
        if (!acc) return 'Account number is required.';
        if (!/^\d+$/.test(acc)) return 'Zemen Bank account number must contain only digits.';
        if (acc.length !== 16) return `Zemen Bank account number must be exactly 16 digits (currently ${acc.length}).`;
        return null;
      }
    };
  }

  // 10. Telebirr / CBE Birr
  if (lower.includes('telebirr') || lower.includes('cbe birr')) {
    return {
      expectedDigits: [10],
      prefix: '09/07',
      placeholder: '0911234567 (10 digits)',
      helpText: '10 digits starting with 09 or 07',
      validate: (acc) => {
        if (!acc) return 'Phone/Wallet number is required.';
        if (!/^\d+$/.test(acc)) return 'Mobile wallet number must contain only digits.';
        if (acc.length !== 10) return `Mobile wallet number must be 10 digits (currently ${acc.length}).`;
        if (!acc.startsWith('09') && !acc.startsWith('07')) return 'Must start with 09 or 07 (e.g. 0911xxxxxx).';
        return null;
      }
    };
  }

  // 11. International / Foreign Bank
  if (lower.includes('other') || lower.includes('international')) {
    return {
      expectedDigits: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34],
      prefix: null,
      placeholder: 'IBAN or Account Number (e.g. GB29NWBK60161331926819)',
      helpText: 'Between 6 and 34 alphanumeric characters',
      validate: (acc) => {
        if (!acc) return 'Account number is required.';
        if (!/^[A-Za-z0-9]+$/.test(acc)) return 'Account number must contain only letters and digits.';
        if (acc.length < 6 || acc.length > 34) return `Must be between 6 and 34 characters (currently ${acc.length}).`;
        return null;
      }
    };
  }

  // Standard Commercial Bank fallback (Amhara, OIB, Buna, Berhan, Abay, Lion, Siinqee, etc.)
  return {
    expectedDigits: [12, 13, 14],
    prefix: null,
    placeholder: '13 or 14-digit account number',
    helpText: 'Standard 13 or 14 digits',
    validate: (acc) => {
      if (!acc) return 'Account number is required.';
      if (!/^\d+$/.test(acc)) return 'Account number must contain only digits.';
      if (acc.length < 8 || acc.length > 16) return `Account number must be between 8 and 16 digits (currently ${acc.length}).`;
      return null;
    }
  };
}

