import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if session token is chunked (split into multiple cookies)
  // This happens when the JWT token is too large (e.g. base64 image stored in it)
  // If we detect chunked tokens (.0, .1, .2, etc.), clear them to force a fresh login
  const cookies = request.cookies;
  const hasChunkedToken = cookies.has('next-auth.session-token.0') || 
                          cookies.has('__Secure-next-auth.session-token.0');

  if (hasChunkedToken) {
    console.log('Detected oversized chunked session token — clearing cookies to force fresh login');
    
    const response = NextResponse.redirect(new URL('/signin', request.url));
    
    // Delete all chunked session token cookies
    for (let i = 0; i <= 10; i++) {
      response.cookies.delete(`next-auth.session-token.${i}`);
      response.cookies.delete(`__Secure-next-auth.session-token.${i}`);
    }
    // Also delete the non-chunked version just in case
    response.cookies.delete('next-auth.session-token');
    response.cookies.delete('__Secure-next-auth.session-token');
    // Clear callback URL cookie to prevent redirect loops
    response.cookies.delete('next-auth.callback-url');
    response.cookies.delete('__Secure-next-auth.callback-url');
    
    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Run on all pages except static files and API routes
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
