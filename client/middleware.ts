import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const goatCounter = process.env.NEXT_PUBLIC_GOAT_COUNTER;
const cspHeader = process.env.NODE_ENV=="development" ? "" : `
	default-src 'self';
	script-src 'self' 'nonce-?' 'strict-dynamic';
	style-src 'self' 'unsafe-inline';
	img-src 'self' blob: data:;
	connect-src 'self' https://login.microsoftonline.com${
		goatCounter ? ` https://${goatCounter}.goatcounter.com` : ""
	};
	font-src 'self';
	object-src 'none';
	base-uri 'self';
	form-action 'self';
	frame-ancestors 'none';
	upgrade-insecure-requests;
`.replaceAll(/\s{2,}/g, ' ').trim();
 
export function middleware(request: NextRequest) {
	request.headers.set("x-method", request.method);

	const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
	request.headers.set("x-nonce", nonce);

  const response = NextResponse.next({request: {headers: request.headers}});
	response.headers.set("Content-Security-Policy", cspHeader.replaceAll("?", nonce));
	return response;
}