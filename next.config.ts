import type { NextConfig } from 'next';

const securityHeaders = [
  {key: 'Content-Security-Policy', value: "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tmssl.akamaized.net https://*.transfermarkt.technology; connect-src 'self'; font-src 'self' data:; upgrade-insecure-requests"},
  {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
  {key: 'X-Content-Type-Options', value: 'nosniff'},
  {key: 'X-Frame-Options', value: 'DENY'},
  {key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()'},
];

const nextConfig: NextConfig = {
  async headers() {
    return [{source: '/(.*)', headers: securityHeaders}];
  },
};

export default nextConfig;

