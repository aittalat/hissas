import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // الحزم الداخلية تُصدَّر كمصدر TypeScript
  transpilePackages: ['@hissas/shared'],
  output: 'standalone',
  // لا يُنشئ AGENTS.md وCLAUDE.md في apps/web: المرجع هو CLAUDE.md في الجذر
  agentRules: false,
};

export default nextConfig;
