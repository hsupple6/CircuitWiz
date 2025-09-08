const jwt = require('jsonwebtoken')
const jwksClient = require('jwks-rsa')

// Create JWKS client for Auth0
const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 5
})

// Get the signing key for JWT verification
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err)
      return
    }
    const signingKey = key.publicKey || key.rsaPublicKey
    callback(null, signingKey)
  })
}

// Middleware to authenticate JWT tokens
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  console.log('=== AUTH MIDDLEWARE DEBUG ===')
  console.log('Auth header:', authHeader ? 'Present' : 'Missing')
  console.log('Token present:', !!token)
  console.log('Token preview:', token ? token.substring(0, 50) + '...' : 'None')
  console.log('Expected audience:', process.env.AUTH0_AUDIENCE)
  console.log('Expected issuer:', `https://${process.env.AUTH0_DOMAIN}/`)

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      message: 'Please provide a valid access token in the Authorization header'
    })
  }

  // First, let's decode the token without verification to see what's in it
  try {
    const decodedUnverified = jwt.decode(token, { complete: true })
    console.log('Unverified token header:', decodedUnverified?.header)
    console.log('Unverified token payload:', decodedUnverified?.payload)
  } catch (decodeErr) {
    console.error('Failed to decode token:', decodeErr.message)
  }

  // Verify the JWT token
  jwt.verify(token, getKey, {
    audience: process.env.AUTH0_AUDIENCE,
    issuer: `https://${process.env.AUTH0_DOMAIN}/`,
    algorithms: ['RS256']
  }, (err, decoded) => {
    if (err) {
      console.error('JWT verification error:', err.message)
      console.error('Error type:', err.name)
      console.error('Token:', token.substring(0, 50) + '...')
      console.error('Audience:', process.env.AUTH0_AUDIENCE)
      console.error('Issuer:', `https://${process.env.AUTH0_DOMAIN}/`)
      console.error('Decoded token (if any):', decoded)
      return res.status(403).json({ 
        error: 'Invalid or expired token',
        message: 'The provided token is invalid or has expired',
        details: err.message
      })
    }
    
    console.log('Token verified successfully!')
    console.log('Decoded user:', {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      audience: decoded.aud,
      issuer: decoded.iss
    })
    
    // Add user info to request object
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
      nickname: decoded.nickname
    }
    
    next()
  })
}

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    req.user = null
    return next()
  }

  jwt.verify(token, getKey, {
    audience: process.env.AUTH0_AUDIENCE,
    issuer: `https://${process.env.AUTH0_DOMAIN}/`,
    algorithms: ['RS256']
  }, (err, decoded) => {
    if (err) {
      req.user = null
    } else {
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        picture: decoded.picture,
        nickname: decoded.nickname
      }
    }
    next()
  })
}

module.exports = {
  authenticateToken,
  optionalAuth
}
