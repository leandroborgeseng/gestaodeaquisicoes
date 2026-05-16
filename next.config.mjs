/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
    serverActions: {
      allowedOrigins: ["*"],
      // Allow uploads up to 20 MB
      bodySizeLimit: "21mb",
    },
  },
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
