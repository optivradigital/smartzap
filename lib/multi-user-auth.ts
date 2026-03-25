/**
 * Multi-User Authentication System for SmartZap
 * 
 * Supports multiple users with email + password login.
 * Uses PBKDF2 (built-in Node.js crypto) for password hashing.
 * Sessions stored in Supabase (user_sessions table).
 * 
 * Migration 005 must be applied before using this module.
 */

import { cookies } from 'next/headers'
import { supabase } from './supabase'
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto'

// ============================================================================
// CONSTANTS
// ============================================================================

const SESSION_COOKIE_NAME = 'smartzap_session'
const ACTIVE_ORG_COOKIE = 'smartzap_active_org'
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7 // 7 days
const PBKDF2_ITERATIONS = 100_000
const PBKDF2_KEYLEN = 64
const PBKDF2_DIGEST = 'sha512'

// ============================================================================
// TYPES
// ============================================================================

export interface SmartZapUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
  createdAt: string
  organizationId?: string
  isSuperAdmin?: boolean
}

export interface AuthResult {
  success: boolean
  error?: string
  user?: SmartZapUser
}

// ============================================================================
// PASSWORD HASHING
// ============================================================================

/**
 * Hash a password using PBKDF2. Returns salt:hash as hex string.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(32).toString('hex')
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex')
  return salt + ':' + hash
}

/**
 * Verify a password against a stored hash.
 */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) return false
    const verify = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString('hex')
    // Timing-safe comparison
    return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verify, 'hex'))
  } catch {
    return false
  }
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * Get all users (admin only)
 */
export async function getAllUsers(): Promise<SmartZapUser[]> {
  const { data, error } = await supabase
    .from('smartzap_users')
    .select('id, email, name, role, created_at')
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return data.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name || '',
    role: u.role as 'admin' | 'user',
    createdAt: u.created_at,
  }))
}

/**
 * Create a new user
 */
export async function createUser(
  email: string,
  password: string,
  name: string,
  role: 'admin' | 'user' = 'user'
): Promise<AuthResult> {
  // Validate
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'E-mail inválido' }
  }
  if (!password || password.length < 6) {
    return { success: false, error: 'Senha deve ter pelo menos 6 caracteres' }
  }

  // Check if email already exists
  const { data: existing } = await supabase
    .from('smartzap_users')
    .select('id')
    .eq('email', email.toLowerCase())
    .single()

  if (existing) {
    return { success: false, error: 'E-mail já cadastrado' }
  }

  const passwordHash = hashPassword(password)
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('smartzap_users')
    .insert({
      email: email.toLowerCase().trim(),
      password_hash: passwordHash,
      name: name.trim(),
      role,
      created_at: now,
    })
    .select('id, email, name, role, created_at')
    .single()

  if (error || !data) {
    console.error('Create user error:', error)
    return { success: false, error: 'Erro ao criar usuário' }
  }

  return {
    success: true,
    user: {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role,
      createdAt: data.created_at,
    }
  }
}

/**
 * Delete a user
 */
export async function deleteUser(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('smartzap_users')
    .delete()
    .eq('id', userId)

  return !error
}

/**
 * Update user password
 */
export async function updateUserPassword(userId: string, newPassword: string): Promise<boolean> {
  if (!newPassword || newPassword.length < 6) return false

  const passwordHash = hashPassword(newPassword)
  const { error } = await supabase
    .from('smartzap_users')
    .update({ password_hash: passwordHash })
    .eq('id', userId)

  return !error
}

// ============================================================================
// LOGIN / LOGOUT
// ============================================================================

/**
 * Login with email and password.
 * Falls back to MASTER_PASSWORD check if no users exist yet.
 */
export async function loginWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!email || !password) {
    return { success: false, error: 'E-mail e senha são obrigatórios' }
  }

  // First: check if there are any users in the new system
  const { count } = await supabase
    .from('smartzap_users')
    .select('*', { count: 'exact', head: true })

  const hasUsers = (count || 0) > 0

  // FALLBACK: If no users yet, accept MASTER_PASSWORD login
  if (!hasUsers) {
    const masterPassword = process.env.MASTER_PASSWORD
    if (masterPassword && password === masterPassword) {
      // Auto-create admin user from env
      const adminResult = await createUser(
        email,
        masterPassword,
        'Admin',
        'admin'
      )
      const userId = adminResult.user?.id || 'legacy-admin'
      await createSessionForUser(userId, email, 'admin')
      return {
        success: true,
        user: adminResult.user || { id: userId, email, name: 'Admin', role: 'admin', createdAt: new Date().toISOString() }
      }
    }
    return { success: false, error: 'Sistema sem usuários. Configure MASTER_PASSWORD ou crie o primeiro usuário.' }
  }

  // Normal login flow
  const { data, error } = await supabase
    .from('smartzap_users')
    .select('id, email, name, role, password_hash')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (error || !data) {
    return { success: false, error: 'E-mail ou senha incorretos' }
  }

  const isValid = verifyPassword(password, data.password_hash)
  if (!isValid) {
    return { success: false, error: 'E-mail ou senha incorretos' }
  }

  // Create session
  await createSessionForUser(data.id, data.email, data.role)

  // Update last login
  await supabase
    .from('smartzap_users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', data.id)

  return {
    success: true,
    user: {
      id: data.id,
      email: data.email,
      name: data.name || '',
      role: data.role as 'admin' | 'user',
      createdAt: new Date().toISOString(),
    }
  }
}

/**
 * Logout - destroy current session
 */
export async function logoutMultiUser(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (token) {
    await supabase.from('smartzap_sessions').delete().eq('token', token)
  }

  cookieStore.delete(SESSION_COOKIE_NAME)
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

async function createSessionForUser(userId: string, email: string, role: string): Promise<void> {
  const cookieStore = await cookies()
  const token = randomBytes(48).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SEC * 1000).toISOString()

  await supabase
    .from('smartzap_sessions')
    .insert({
      user_id: userId,
      token,
      email,
      role,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    })

  // Clean up expired sessions in background
  supabase.from('smartzap_sessions').delete().lt('expires_at', new Date().toISOString())

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SEC,
    path: '/',
  })
}

/**
 * Get current user from session
 */
export async function getCurrentUser(): Promise<SmartZapUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if (!token) return null

    const { data, error } = await supabase
      .from('smartzap_sessions')
      .select('user_id, email, role, expires_at')
      .eq('token', token)
      .single()

    if (error || !data) return null

    // Check expiry
    if (new Date(data.expires_at) < new Date()) {
      await supabase.from('smartzap_sessions').delete().eq('token', token)
      return null
    }

    // Get fresh user data
    const { data: user } = await supabase
      .from('smartzap_users')
      .select('id, email, name, role, created_at, organization_id, is_super_admin')
      .eq('id', data.user_id)
      .single()

    if (!user) return null

    const isSuperAdmin = user.is_super_admin || false

    // For super_admin: use the active org cookie if set
    let effectiveOrgId: string | undefined = user.organization_id || undefined
    if (isSuperAdmin) {
      const activeOrgCookie = cookieStore.get(ACTIVE_ORG_COOKIE)?.value
      if (activeOrgCookie) {
        effectiveOrgId = activeOrgCookie
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name || '',
      role: user.role as 'admin' | 'user',
      createdAt: user.created_at,
      organizationId: effectiveOrgId,
      isSuperAdmin,
    }
  } catch {
    return null
  }
}

/**
 * Get the active org ID from the cookie (super_admin org switcher)
 */
export async function getActiveOrgId(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    return cookieStore.get(ACTIVE_ORG_COOKIE)?.value || null
  } catch {
    return null
  }
}

/**
 * Check if the current session is valid (any user)
 */
export async function validateMultiUserSession(): Promise<boolean> {
  const user = await getCurrentUser()
  return user !== null
}
