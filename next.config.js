/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove or comment out the output: 'export' line
  // output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: { unoptimized: true },
  devIndicators: false
};

module.exports = nextConfig;
