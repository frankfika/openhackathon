import React, { createContext, useContext, useState, useEffect } from 'react'
import { User } from './types'
import { api } from './api'

type AuthContextType = {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
  error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check local storage for persisted user
    const savedUser = localStorage.getItem('openhackathon_user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch {
        console.error('Failed to parse user from local storage')
      }
    }
    setIsLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    setError(null)
    setIsLoading(true)
    try {
      const user = await api.login(email, password)
      setUser(user)
      localStorage.setItem('openhackathon_user', JSON.stringify(user))
    } catch (err: any) {
      const message = err.response?.data?.error || 'Login failed. Please try again.'
      setError(message)
      throw new Error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('openhackathon_user')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
