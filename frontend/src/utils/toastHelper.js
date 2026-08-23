import toast from 'react-hot-toast';

/**
 * Extracts and formats detailed, human-readable error messages from API responses.
 * Never displays generic "One or more validation errors occurred."
 * Specifically extracts individual field validation messages, Identity errors, or custom backend messages.
 * 
 * @param {string|Object} err - Raw error response string or error object.
 * @returns {string} Detailed, actionable error message.
 */
export const parseApiError = (err) => {
  if (!err) return 'An unexpected error occurred.';

  // If already an object
  if (typeof err === 'object' && err !== null) {
    // 1. Check ASP.NET Core ModelState validation dictionary
    if (err.errors && typeof err.errors === 'object') {
      const errorList = [];
      for (const field in err.errors) {
        const msgs = err.errors[field];
        if (Array.isArray(msgs)) {
          errorList.push(...msgs);
        } else if (msgs) {
          errorList.push(String(msgs));
        }
      }
      if (errorList.length > 0) {
        return errorList.join(' ');
      }
    }

    // 2. Custom error message property
    if (err.message && err.message !== 'One or more validation errors occurred.') {
      return err.message;
    }

    // 3. Custom error property
    if (err.error) {
      return typeof err.error === 'string' ? err.error : JSON.stringify(err.error);
    }

    // 4. Detail property from ProblemDetails
    if (err.detail) {
      return err.detail;
    }

    // 5. Title property (if not generic)
    if (err.title && err.title !== 'One or more validation errors occurred.') {
      return err.title;
    }

    return 'Please check the entered values and try again.';
  }

  if (typeof err !== 'string') {
    return 'An unexpected error occurred.';
  }

  // Try parsing JSON string
  try {
    const data = JSON.parse(err);

    // 1. Array of error messages (e.g. Identity errors)
    if (Array.isArray(data)) {
      return data
        .map(item => (typeof item === 'object' ? item.description || item.message || JSON.stringify(item) : String(item)))
        .join(' ');
    }

    // 2. ASP.NET Core ModelState validation dictionary
    if (data.errors && typeof data.errors === 'object') {
      const errorList = [];
      for (const field in data.errors) {
        const msgs = data.errors[field];
        if (Array.isArray(msgs)) {
          errorList.push(...msgs);
        } else if (msgs) {
          errorList.push(String(msgs));
        }
      }
      if (errorList.length > 0) {
        return errorList.join(' ');
      }
    }

    // 3. Custom error format { message: "..." }
    if (data.message && data.message !== 'One or more validation errors occurred.') {
      return data.message;
    }

    // 4. Custom error format { error: "..." }
    if (data.error) {
      return typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
    }

    // 5. Detail property from ProblemDetails
    if (data.detail) {
      return data.detail;
    }

    // 6. Generic Title (if not the generic validation error text)
    if (data.title && data.title !== 'One or more validation errors occurred.') {
      return data.title;
    }

    return 'Please check the entered values and try again.';
  } catch (e) {
    // Plain text response from server
    return err.trim() || 'An unexpected error occurred.';
  }
};

/**
 * Clones a Fetch API Response, reads its text body, and parses the contained error message.
 * @param {Response} res - The Fetch Response object.
 * @returns {Promise<string>} Parsed detailed error message.
 */
export const parseApiResponse = async (res) => {
  try {
    const text = await res.clone().text();
    return parseApiError(text);
  } catch {
    return 'Failed to read response from server.';
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
      borderRadius: '12px',
      background: '#fff',
      color: '#0f172a',
      fontSize: '13px',
      padding: '12px 16px',
      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
      border: '1px solid #fee2e2'
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
      borderRadius: '12px',
      background: '#fff',
      color: '#0f172a',
      fontSize: '13px',
      padding: '12px 16px',
      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
      border: '1px solid #dcfce7'
    },
    duration: 3500,
  });
};
