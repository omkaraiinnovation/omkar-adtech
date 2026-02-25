import type { Config } from 'tailwindcss';
import sharedConfig from '@omkar-adtech/config/tailwind';

const config: Config = {
  ...sharedConfig,
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    ...sharedConfig.theme,
    extend: {
      ...sharedConfig.theme?.extend,
    },
  },
};

export default config;
