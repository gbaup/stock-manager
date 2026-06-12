import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) throw new Error('SESSION_SECRET is not set');
const secret = new TextEncoder().encode(sessionSecret);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/login' || pathname.startsWith('/public')) return NextResponse.next();

  const session = request.cookies.get('session')?.value;
  let valid = false;
  if (session) {
    try {
      await jwtVerify(session, secret, { algorithms: ['HS256'] });
      valid = true;
    } catch {}
  }

  if (!valid) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
