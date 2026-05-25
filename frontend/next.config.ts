import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['127.0.0.1'],
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://127.0.0.1:8015/api/v1/:path*',
      },
      {
        source: '/api/uploads/:path*',
        destination: 'http://127.0.0.1:8015/api/uploads/:path*',
      },
    ];
  },
};

export default nextConfig;
