import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://sarim-mbzuai.github.io',
  output: 'static',
  build: {
    assets: '_astro'
  }
});
