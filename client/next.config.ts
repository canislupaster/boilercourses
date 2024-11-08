import { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import { join } from "node:path";
import { cwd } from "node:process";

export default (phase: string): NextConfig => ({
  reactStrictMode: true,
  // eslint-disable-next-line @typescript-eslint/require-await
  async rewrites() {
    if (phase==PHASE_DEVELOPMENT_SERVER) return [
      { source: '/api/:path*', destination: `${process.env["SERVER_URL"]}/:path*` }
    ]
    else return [];
  },
  experimental: {
    turbo: {
      root: join(cwd(), "..")
    }
  }
});