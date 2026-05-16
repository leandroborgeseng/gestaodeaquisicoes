/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
    serverActions: {
      allowedOrigins: ["*"],
    },
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
