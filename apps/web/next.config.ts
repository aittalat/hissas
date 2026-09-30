import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // الحزم الداخلية تُصدَّر كمصدر TypeScript
  transpilePackages: ['@hissas/shared'],
  output: 'standalone',
};

export default nextConfig;
