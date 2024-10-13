import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {import('next').NextConfig} */
export default (phase) => ({
  reactStrictMode: true,
  rewrites() {
    if (phase==PHASE_DEVELOPMENT_SERVER) return [
      { source: '/api/:path*', destination: `${process.env["SERVER_URL"]}/:path*` },
    ]
    else return [];
  }
});