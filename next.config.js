/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    TMDB_API_KEY: process.env.TMDB_API_KEY,
    DISABLE_DEV_TOOLS: process.env.DISABLE_DEV_TOOLS,
  },
  images: {
    domains: ['image.tmdb.org', 'lh3.googleusercontent.com'],
  },
  // webpack configuration removed - using default Next.js resolution
};

module.exports = nextConfig;
