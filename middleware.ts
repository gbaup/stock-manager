import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/app/lib/auth';

export async function middleware(request: NextRequest) {
    const protectedRoutes = ['/dashboard'];
    const currentPath = request.nextUrl.pathname;

    if (protectedRoutes.some((route) => currentPath.startsWith(route))) {
        const sessionCookie = request.cookies.get('session')?.value;
        const session = await decrypt(sessionCookie);

        if (!session?.userId) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/dashboard/:path*', '/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
