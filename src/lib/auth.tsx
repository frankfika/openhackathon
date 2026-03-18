import React, { createContext, useContext, useState, useEffect } from 'react'
import { User } from './types'
import { api } from './api'

type AuthApiError = {
  response?: {
    data?: {
      error?: string
    }
  }
}

function getLoginErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const apiError = err as AuthApiError
    if (apiError.response?.data?.error) {
      return apiError.response.data.error
    }
  }
  return 'Login failed. Please try again.'
}

type AuthContextType = {
  user: User | null
  login: (email: string, password: string) => Promise<User>
  logout: () => void
  isLoading: boolean
  error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const USER_STORAGE_KEY = 'openhackathon_user'
const TOKEN_STORAGE_KEY = 'openhackathon_token'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check local storage for persisted user
    const savedUser = localStorage.getItem(USER_STORAGE_KEY)
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
      const loginResult = await api.login(email, password)
      const { token, ...user } = loginResult
      setUser(user)
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token)
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY)
      }
      return user
    } catch (err: unknown) {
      const message = getLoginErrorMessage(err)
      setError(message)
      throw new Error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem(USER_STORAGE_KEY)
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
