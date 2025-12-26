// src/hooks/use-auth.ts

export function useAuth() {
  return {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    signinRedirect: async () => {},
    signoutRedirect: async () => {},
    fetchAccessToken: async () => null,
  };
}

export function useUser() {
  return {
    id: null,
    name: null,
    email: null,
    avatar: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  };
}
