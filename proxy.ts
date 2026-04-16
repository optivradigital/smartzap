import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/login(.*)',
  '/signup(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/auth(.*)',
  '/api/webhook(.*)',
  '/api/chatwoot-bot(.*)',
  '/api/health(.*)',
  '/api/system(.*)',
  '/api/setup(.*)',
  '/api/debug(.*)',
  '/api/database(.*)',
  '/api/campaign/workflow(.*)',
  '/api/campaign/process(.*)',
  '/api/account/alerts(.*)',
])

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    '/(api|trpc)(.*)',
  ],
}

export const proxy = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})
