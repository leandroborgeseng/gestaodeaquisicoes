/** @type {import('next').NextConfig} */
const nextConfig = {
  // NOTE: standalone removed — Railway nixpacks uses `next start` directly.
  // Standalone mode requires manually copying static files which nixpacks doesn't do.
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  experimental: {
    serverActions: {
      allowedOrigins: ["*"],
    },
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
