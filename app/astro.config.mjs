// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://ronniechong.com',
  base: '/status-quo',
  integrations: [react()]
});