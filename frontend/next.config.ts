import type { NextConfig } from "next";

const apiServer = process.env.SERVER_API_URL || "http://127.0.0.1:8000/api/v1";
const uploadServer = apiServer.replace(/\/api\/v1\/?$/, "/api/uploads");

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['127.0.0.1'],
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiServer}/:path*`,
      },
      {
        source: '/api/uploads/:path*',
        destination: `${uploadServer}/:path*`,
      },
    ];
  },
};

export default nextConfig;
