import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

// Plugin to copy and process assets to dist
const copyAssetsPlugin = (buildMode: string) => {
  return {
    name: 'copy-assets-plugin',
    writeBundle: async () => {
      const distDir = 'dist';

      // Create dist directory if it doesn't exist
      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
      }

      // Make sure the icons directory exists
      const iconDir = resolve(__dirname, `${distDir}/icons`);
      if (!fs.existsSync(iconDir)) {
        fs.mkdirSync(iconDir, { recursive: true });
      }

      // Process manifest.json for the appropriate build mode
      const manifestPath = resolve(__dirname, 'src/manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      if (buildMode === 'debug') {
        // Modify manifest for debug build
        manifest.name = `${manifest.name} (Debug)`;
        manifest.description = `${manifest.description} [DEBUG BUILD]`;
      }

      // Write the processed manifest
      fs.writeFileSync(
        resolve(__dirname, `${distDir}/manifest.json`),
        JSON.stringify(manifest, null, 2)
      );

      // Copy saved-tabs HTML file to dist
      try {
        fs.copyFileSync(
          resolve(__dirname, 'src/saved-tabs.html'),
          resolve(__dirname, `${distDir}/saved-tabs.html`)
        );
      } catch (e) {
        console.warn('Warning: Could not copy saved-tabs.html');
      }

      // Copy icon files - assuming they exist in images/icons
      const iconSizes = [16, 48, 128];
      iconSizes.forEach(size => {
        try {
          fs.copyFileSync(
            resolve(__dirname, `images/icon${size}.png`),
            resolve(__dirname, `${distDir}/icons/icon${size}.png`)
          );
        } catch (e) {
          console.warn(`Warning: Could not copy icon${size}.png`);
        }
      });
    }
  };
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const buildMode = mode === 'debug' ? 'debug' : 'release';
  const isDebug = buildMode === 'debug';

  console.log(`Building for ${buildMode} mode`);

  const outDir = 'dist';

  return {
    plugins: [copyAssetsPlugin(buildMode)],
    build: {
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'src/popup/popup.html'),
          'saved-tabs': resolve(__dirname, 'src/saved-tabs.ts')
        },
        output: {
          entryFileNames: (chunkInfo) => {
            // For saved-tabs.js, output directly to dist root
            if (chunkInfo.name === 'saved-tabs') {
              return '[name].js';
            }
            // For popup, maintain the folder structure
            return 'popup/[name].js';
          }
        }
      },
      outDir,
      emptyOutDir: true,

      // Debug specific settings
      minify: !isDebug,     // Minify only for release build
      sourcemap: isDebug    // Generate sourcemaps only for debug build
    }
  };
});