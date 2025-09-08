import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'

interface User {
  id: string
  email: string
  name: string
  picture?: string
  nickname?: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: () => void
  logout: () => void
  getAccessToken: () => Promise<string>
  error?: Error
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { 
    user: auth0User, 
    isLoading, 
    isAuthenticated,
    loginWithRedirect, 
    logout: auth0Logout, 
    getAccessTokenSilently,
    error
  } = useAuth0()

  console.log('Auth0 State:', { 
    isLoading, 
    isAuthenticated, 
    user: auth0User?.name || 'No user',
    error: error?.message || 'No error'
  })
  
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (auth0User && isAuthenticated) {
      // Sync user to your database on first login
      syncUserToDatabase(auth0User)
      
      setUser({
        id: auth0User.sub!,
        email: auth0User.email!,
        name: auth0User.name!,
        picture: auth0User.picture,
        nickname: auth0User.nickname
      })
    } else {
      setUser(null)
    }
  }, [auth0User, isAuthenticated])

  const syncUserToDatabase = async (auth0User: any) => {
    try {
      const token = await getAccessTokenSilently({
        audience: (import.meta as any).env.VITE_AUTH0_AUDIENCE
      })
      await fetch(`${(import.meta as any).env.VITE_API_URL || 'http://localhost:3001'}/api/users/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: auth0User.sub,
          email: auth0User.email,
          name: auth0User.name,
          picture: auth0User.picture,
          nickname: auth0User.nickname
        })
      })
    } catch (error) {
      console.error('Failed to sync user to database:', error)
    }
  }

  const getAccessToken = async () => {
    try {
      const token = await getAccessTokenSilently({
        audience: (import.meta as any).env.VITE_AUTH0_AUDIENCE
      })
      console.log('=== FRONTEND TOKEN DEBUG ===')
      console.log('Token obtained:', !!token)
      console.log('Token preview:', token ? token.substring(0, 50) + '...' : 'None')
      console.log('Requested audience:', (import.meta as any).env.VITE_AUTH0_AUDIENCE)
      return token
    } catch (error) {
      console.error('Failed to get access token:', error)
      throw error
    }
  }

  const login = () => {
    console.log('Login button clicked')
    console.log('Auth0 domain:', (import.meta as any).env.VITE_AUTH0_DOMAIN)
    console.log('Client ID:', (import.meta as any).env.VITE_AUTH0_CLIENT_ID)
    console.log('Audience:', (import.meta as any).env.VITE_AUTH0_AUDIENCE)
    
    loginWithRedirect({
      appState: {
        returnTo: window.location.pathname
      }
    })
  }

  const logout = () => {
    auth0Logout({
      returnTo: window.location.origin
    })
  }

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated,
      login,
      logout,
      getAccessToken,
      error
    }}>
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
