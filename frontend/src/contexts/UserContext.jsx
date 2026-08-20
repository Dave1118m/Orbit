import { createContext, useContext, useState, useEffect } from 'react';
import { parseApiResponse } from '../utils/toastHelper';

/**
 * Context for managing user authentication state and authorization.
 */
const UserContext = createContext();

/**
 * Custom React hook to access authentication state, current user profile, active roles, and permission checks.
 * @returns {{
 *   user: Object|null,
 *   loading: boolean,
 *   hasPermission: (permission: string) => boolean,
 *   hasRole: (role: string) => boolean,
 *   getPrimaryRole: () => string|null,
 *   setUser: Function,
 *   switchPersona: (roleName: string) => Promise<{success: boolean, user?: Object, error?: string}>,
 *   refreshUser: () => Promise<void>
 * }}
 */
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

/**
 * Context Provider component that initializes authentication state, loads user profile data, and exposes authorization helpers.
 * @param {{ children: React.ReactNode }} props
 */
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * Fetches the currently authenticated user's profile and dynamic permissions from `/api/v1/users/me`.
   */
  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  /**
   * Switches the active persona/role for testing or multi-role users, updating JWT tokens and permissions.
   * @param {string} roleName - The target system role (e.g. 'Owner', 'FinanceOfficer', 'Coordinator').
   * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
   */
  const switchPersona = async (roleName) => {
    try {
      const selectedOrgId = localStorage.getItem('selectedOrganizationId');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/switch-persona`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roleName,
          organizationId: selectedOrgId ? parseInt(selectedOrgId, 10) : null
        })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        setUser(data.user);
        window.dispatchEvent(new Event('personaChanged'));
        return { success: true, user: data.user };
      } else {
        const errText = await parseApiResponse(response);
        console.error('Failed to switch persona:', errText);
        return { success: false, error: errText };
      }
    } catch (error) {
      console.error('Error switching persona:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Evaluates if the active user possesses a given permission string.
   * Organization Owners automatically bypass and return true.
   * @param {string} permission - The permission name (e.g. 'ProjectCreate', 'ExpenseApprove').
   * @returns {boolean}
   */
  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.roles && user.roles.some(r => r.name === 'Owner')) return true;
    if (!user.permissions) return false;
    return user.permissions.includes(permission);
  };

  /**
   * Evaluates if the active user holds a specific role name.
   * @param {string} role - The role name (e.g. 'Admin', 'Manager').
   * @returns {boolean}
   */
  const hasRole = (role) => {
    if (!user || !user.roles) return false;
    return user.roles.some(r => r.name === role);
  };

  /**
   * Returns the primary role name assigned to the user in their active organization context.
   * @returns {string|null}
   */
  const getPrimaryRole = () => {
    if (!user || !user.roles || user.roles.length === 0) return null;
    return user.roles[0].name;
  };

  const value = {
    user,
    loading,
    hasPermission,
    hasRole,
    getPrimaryRole,
    setUser,
    switchPersona,
    refreshUser: fetchUserData
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
