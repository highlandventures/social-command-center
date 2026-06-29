/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer'],
  },
  async rewrites() {
    return [
      // Serve /public/rwahouse.html at clean /rwahouse URL
      { source: '/rwahouse', destination: '/rwahouse.html' },
      // Serve /public/hash.html at clean /hash URL
      { source: '/hash', destination: '/hash.html' },
    ];
  },
};

module.exports = nextConfig;
