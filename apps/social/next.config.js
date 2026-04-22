/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer'],
  },
  async rewrites() {
    return [
      // Serve /public/rwahouse.html at clean /rwahouse URL
      { source: '/rwahouse', destination: '/rwahouse.html' },
    ];
  },
};

module.exports = nextConfig;
