import React, { createContext, useContext, useState, useEffect } from 'react'
import { User, users, UserRole } from './mock-data'

type AuthContextType = {
  user: User | null
  login: (role: UserRole) => void
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check local storage for persisted user
    const savedUser = localStorage.getItem('openhackathon_user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (e) {
        console.error('Failed to parse user from local storage')
      }
    }
    setIsLoading(false)
  }, [])

  const login = (role: UserRole) => {
    // Find the first user with the matching role
    const foundUser = users.find((u) => u.role === role) || users[0]
    setUser(foundUser)
    localStorage.setItem('openhackathon_user', JSON.stringify(foundUser))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('openhackathon_user')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
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
