import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

type BuildMode = 'release' | 'debug' | 'e2e';

// Plugin to copy and process assets to dist
const copyAssetsPlugin = (buildMode: BuildMode, outDir: string) => {
  return {
    name: 'copy-assets-plugin',
    writeBundle: async () => {
      // Create dist directory if it doesn't exist
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      // Make sure the icons directory exists
      const iconDir = resolve(__dirname, `${outDir}/icons`);
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

      if (buildMode === 'e2e') {
        manifest.background = {
          service_worker: 'background.js',
          type: 'module',
        };
      }

      // Write the processed manifest
      fs.writeFileSync(
        resolve(__dirname, `${outDir}/manifest.json`),
        JSON.stringify(manifest, null, 2)
      );

      // Copy saved-tabs HTML file to dist
      try {
        fs.copyFileSync(
          resolve(__dirname, 'src/saved-tabs.html'),
          resolve(__dirname, `${outDir}/saved-tabs.html`)
        );
      } catch (e) {
        console.warn('Warning: Could not copy saved-tabs.html');
      }

      // Copy icon files - assuming they exist in images/icons
      const iconSizes = [16, 32, 128, 256];
      iconSizes.forEach(size => {
        try {
          fs.copyFileSync(
            resolve(__dirname, `images/icon-${size}.png`),
            resolve(__dirname, `${outDir}/icons/icon-${size}.png`)
          );
        } catch (e) {
          console.warn(`Warning: Could not copy icon-${size}.png`);
        }
      });
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const buildMode: BuildMode = mode === 'debug' ? 'debug' : mode === 'e2e' ? 'e2e' : 'release';
  const isDebug = buildMode === 'debug';
  const isE2E = buildMode === 'e2e';

  console.log(`Building for ${buildMode} mode`);

  const outDir = isE2E ? 'dist-e2e' : 'dist';

  const input: Record<string, string> = {
    popup: resolve(__dirname, 'src/popup/popup.html'),
    'saved-tabs': resolve(__dirname, 'src/saved-tabs.ts'),
  };

  if (isE2E) {
    input.background = resolve(__dirname, 'src/e2e/background.ts');
  }

  return {
    plugins: [copyAssetsPlugin(buildMode, outDir)],
    build: {
      rollupOptions: {
        input,
        output: {
          entryFileNames: chunkInfo => {
            // For saved-tabs.js, output directly to dist root
            if (chunkInfo.name === 'saved-tabs' || chunkInfo.name === 'background') {
              return '[name].js';
            }
            // For popup, maintain the folder structure
            return 'popup/[name].js';
          },
        },
      },
      outDir,
      emptyOutDir: true,

      // Debug specific settings
      minify: !isDebug, // Minify only for release build
      sourcemap: isDebug, // Generate sourcemaps only for debug build
    },
  };
});
