import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
 
export function middleware(request: NextRequest) {
	request.headers.set("x-method", request.method);
  return NextResponse.next({request: {headers: request.headers}});
}