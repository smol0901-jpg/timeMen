import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../lib/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      login: (user: User, token: string) => set({ 
        user, 
        token, 
        isAuthenticated: true 
      }),
      
      logout: () => set({ 
        user: null, 
        token: null, 
        isAuthenticated: false 
      }),
      
      updateUser: (userData: Partial<User>) => set((state: AuthState) => ({
        user: state.user ? { ...state.user, ...userData } : null
      })),
    }),
    {
      name: 'smenalan-auth',
    }
  )
);
