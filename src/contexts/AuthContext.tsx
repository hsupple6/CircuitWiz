import React, { createContext, useContext } from 'react'
// import { useAuth0 } from '@auth0/auth0-react'

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

const LOCAL_DEV_USER: User = {
  id: 'local-dev-user',
  email: 'dev@localhost',
  name: 'Local Dev',
}

// Auth disabled for local development — always authenticated, no redirects on reload
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value: AuthContextType = {
    user: LOCAL_DEV_USER,
    isLoading: false,
    isAuthenticated: true,
    login: () => {},
    logout: () => {},
    getAccessToken: async () => 'local-dev-token',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/*
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

  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (auth0User && isAuthenticated) {
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

  ...
}
*/

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
