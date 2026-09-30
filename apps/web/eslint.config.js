import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import { ignores } from '@hissas/config/eslint';

const config = [ignores, ...nextVitals, ...nextTs, { ignores: ['next-env.d.ts'] }];

export default config;
