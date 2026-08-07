import { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext();

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
        const errText = await response.text();
        console.error('Failed to switch persona:', errText);
        return { success: false, error: errText };
      }
    } catch (error) {
      console.error('Error switching persona:', error);
      return { success: false, error: error.message };
    }
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.roles && user.roles.some(r => r.name === 'Owner')) return true;
    if (!user.permissions) return false;
    return user.permissions.includes(permission);
  };

  const hasRole = (role) => {
    if (!user || !user.roles) return false;
    return user.roles.some(r => r.name === role);
  };

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
