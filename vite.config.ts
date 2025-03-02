import { defineConfig } from 'vite';
import { resolve } from 'path';
import { writeFileSync, copyFileSync, mkdirSync, existsSync } from 'fs';

// Plugin to copy manifest and other assets to dist
const copyManifestPlugin = () => {
  return {
    name: 'copy-manifest',
    writeBundle: async () => {
      // Make sure the icons directory exists
      const iconDir = resolve(__dirname, 'dist/icons');
      if (!existsSync(iconDir)) {
        mkdirSync(iconDir, { recursive: true });
      }
      
      // Copy manifest.json
      copyFileSync(
        resolve(__dirname, 'src/manifest.json'),
        resolve(__dirname, 'dist/manifest.json')
      );
      
      // Copy icon files - assuming they exist in src/icons
      const iconSizes = [16, 48, 128];
      iconSizes.forEach(size => {
        try {
          copyFileSync(
            resolve(__dirname, `images/icon${size}.png`),
            resolve(__dirname, `dist/icons/icon${size}.png`)
          );
        } catch (e) {
          console.warn(`Warning: Could not copy icon${size}.png`);
        }
      });
    }
  };
};

export default defineConfig({
  plugins: [copyManifestPlugin()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html')
      },
      output: {
        entryFileNames: '[name]/[name].js'
      }
    },
    outDir: 'dist',
    emptyOutDir: true
  }
});
