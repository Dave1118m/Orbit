import toast from 'react-hot-toast';

/**
 * Parses raw API error response text into human-readable error messages.
 * Handles custom error JSON `{ message: "..." }`, ASP.NET Core ModelState validation dictionary `{ errors: { ... } }`,
 * problem details `{ title: "..." }`, or raw text strings.
 * @param {string|Object} errText - Raw error response string or error object.
 * @returns {string} Clean error message.
 */
export const parseApiError = (errText) => {
  if (!errText) return 'An unexpected error occurred.';
  if (typeof errText !== 'string') return errText.message || 'An unexpected error occurred.';

  try {
    const data = JSON.parse(errText);
    
    // Custom error format { message: "..." }
    if (data.message) {
      return data.message;
    }
    
    // ASP.NET Core ModelState validation errors
    if (data.errors && typeof data.errors === 'object') {
      const errorMessages = [];
      for (const key in data.errors) {
        const messages = data.errors[key];
        if (Array.isArray(messages)) {
          errorMessages.push(...messages);
        } else {
          errorMessages.push(messages);
        }
      }
      if (errorMessages.length > 0) return errorMessages.join(' ');
    }
    
    // Generic Title
    if (data.title) {
      return data.title;
    }

    return 'An unexpected error occurred.';
  } catch (e) {
    // Not JSON, return raw text or fallback
    return errText || 'An unexpected error occurred.';
  }
};

/**
 * Clones a Fetch API Response, reads its text body, and parses the contained error message.
 * @param {Response} res - The Fetch Response object.
 * @returns {Promise<string>} Parsed error message.
 */
export const parseApiResponse = async (res) => {
  try {
    const text = await res.clone().text();
    return parseApiError(text);
  } catch {
    return 'Failed to parse API error.';
  }
};

/**
 * Displays a styled error toast notification with formatted message parsing.
 * @param {string|Object} errMessage - Error message or payload.
 * @param {string} [fallback='Something went wrong.'] - Fallback message if parsing fails.
 */
export const showErrorToast = (errMessage, fallback = 'Something went wrong.') => {
  const parsed = parseApiError(errMessage);
  toast.error(parsed || fallback, {
    position: 'top-right',
    style: {
      borderRadius: '8px',
      background: '#fff',
      color: '#333',
      fontSize: '13px',
      padding: '12px 16px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    },
    duration: 5000,
  });
};

/**
 * Displays a styled success toast notification.
 * @param {string} message - Success notification message.
 */
export const showSuccessToast = (message) => {
  toast.success(message, {
    position: 'top-right',
    style: {
      borderRadius: '8px',
      background: '#fff',
      color: '#333',
      fontSize: '13px',
      padding: '12px 16px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
    },
    duration: 3000,
  });
};
