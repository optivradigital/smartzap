import { NextRequest, NextResponse } from 'next/server'
import {
    verifyApiKey,
    verifyAdminAccess,
    isAdminEndpoint,
    isPublicEndpoint,
    unauthorizedResponse,
    forbiddenResponse
} from '@/lib/auth'

export const config = {
    matcher: [
        // Match all pages except static files and _next
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}

// Routes that don't require user authentication
const PUBLIC_PAGES = ['/login', '/setup', '/debug-auth']
const PUBLIC_API_ROUTES = ['/api/auth', '/api/webhook', '/api/health', '/api/system', '/api/setup', '/api/debug', '/api/database', '/api/campaign/workflow', '/api/campaign/process', '/api/account/alerts']

export async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname

    // Allow OPTIONS requests for CORS preflight
    if (request.method === 'OPTIONS') {
        return NextResponse.next()
    }

    // ==========================================================================
    // BOOTSTRAP CHECK - Redirect to setup if not configured
    // ==========================================================================
    const hasMasterPassword = !!process.env.MASTER_PASSWORD
    const isSetupComplete = !!process.env.SETUP_COMPLETE

    // If not configured and not already on setup, redirect immediately
    if (!hasMasterPassword) {
        if (!pathname.startsWith('/setup') && !pathname.startsWith('/api')) {
            const setupUrl = new URL('/setup/start', request.url)
            return NextResponse.redirect(setupUrl)
        }
    }

    // If configured but setup not complete (company info missing), go to wizard
    if (hasMasterPassword && !isSetupComplete) {
        if (!pathname.startsWith('/setup') && !pathname.startsWith('/api') && !pathname.startsWith('/debug')) {
            const wizardUrl = new URL('/setup/wizard?resume=true', request.url)
            return NextResponse.redirect(wizardUrl)
        }
    }

    // If configured and on OLD bootstrap setup, redirect to login or new start?
    // Actually, if configured, we might want to allow /setup/start if user WANTS to fix envs.
    // But generally, the legacy logic redirected to login.
    // Let's REMOVE the forced redirect to login if /setup/bootstrap is visited, 
    // because we renamed it to /setup/start and we want to allow re-configuration if needed.
    // However, we should block /setup/bootstrap (old) to avoid 404? No, it's 404 anyway.

    // ==========================================================================
    // API Routes - Use API Key authentication
    // ==========================================================================
    if (pathname.startsWith('/api/')) {
        // Auth endpoints are always public
        if (PUBLIC_API_ROUTES.some(route => pathname.startsWith(route))) {
            return NextResponse.next()
        }

        // Public endpoints don't require authentication
        if (isPublicEndpoint(pathname)) {
            return NextResponse.next()
        }

        // Admin endpoints require admin-level access
        if (isAdminEndpoint(pathname)) {
            const adminAuth = await verifyAdminAccess(request)

            if (!adminAuth.valid) {
                return adminAuth.error?.includes('Admin')
                    ? forbiddenResponse(adminAuth.error)
                    : unauthorizedResponse(adminAuth.error)
            }

            return NextResponse.next()
        }

        // Check for user session cookie (for browser API calls)
        const sessionCookie = request.cookies.get('smartzap_session')
        if (sessionCookie?.value) {
            // Session exists, allow request (validation happens in API route)
            return NextResponse.next()
        }

        // All other API endpoints require at least API key
        const authResult = await verifyApiKey(request)

        if (!authResult.valid) {
            return unauthorizedResponse(authResult.error)
        }

        return NextResponse.next()
    }

    // ==========================================================================
    // Page Routes - Use Session Cookie authentication
    // ==========================================================================

    // Public pages don't require authentication
    if (PUBLIC_PAGES.some(page => pathname.startsWith(page))) {
        return NextResponse.next()
    }

    // Check for session cookie
    const sessionCookie = request.cookies.get('smartzap_session')

    // No session cookie - redirect to login
    if (!sessionCookie?.value) {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(loginUrl)
    }

    // Session cookie exists - allow access (validation happens in layout)
    return NextResponse.next()
}
