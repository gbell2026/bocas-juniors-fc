/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Type checking is run locally before every push — skip during Vercel build to prevent hangs
    ignoreBuildErrors: true,
  },
  eslint: {
    // ESLint is run locally before every push — skip during Vercel build
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
