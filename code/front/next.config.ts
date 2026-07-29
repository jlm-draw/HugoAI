import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    turbo: {
      rules: {
        '*.md': {
          loaders: ['@mdx-js/loader'],
          as: '*.mdx',
        },
      },
    },
  },
  images: {
    domains: ['example.com'],
  },
};

export default nextConfig;