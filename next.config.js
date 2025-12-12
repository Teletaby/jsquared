/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    TMDB_API_KEY: process.env.TMDB_API_KEY,
  },
  images: {
    domains: ['image.tmdb.org', 'lh3.googleusercontent.com'],
  },
  // webpack configuration removed - using default Next.js resolution
};

module.exports = nextConfig;
