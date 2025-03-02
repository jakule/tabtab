# TabTab

A Chrome extension to manage tabs by grouping them based on domain.

## Features

- Group tabs by domain automatically
- Ungroup all tabs with one click
- Save and close tabs for later retrieval
- View and manage saved tabs with search functionality
- Export and import saved tabs

## Development

This project uses TypeScript, Vite for bundling, ESLint for linting, and Jest for testing.

### Setup

```bash
# Install dependencies
pnpm install
```

### Development Commands

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Build for debugging (includes sourcemaps)
pnpm build:debug

# Preview the build
pnpm preview

# Run linter
pnpm lint

# Fix linting issues
pnpm lint:fix

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

### Project Structure

```
├── src/                  # Source code
│   ├── popup/            # Extension popup UI
│   ├── test/             # Test setup and helpers
│   ├── types/            # TypeScript type definitions
│   ├── manifest.json     # Extension manifest
│   ├── saved-tabs.html   # Saved tabs UI
│   ├── saved-tabs.ts     # Saved tabs functionality
│   └── utils.ts          # Utility functions
├── images/               # Extension icons
├── dist/                 # Build output (generated)
├── jest.config.ts        # Jest configuration
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite configuration
├── .eslintrc.json        # ESLint configuration
└── package.json          # Project metadata and scripts
```

### Testing

Tests are written using Jest and run in a jsdom environment. Chrome APIs are mocked in the test setup file to allow testing extension functionality without the Chrome runtime.

To add new tests, create files with the `.test.ts` extension alongside the code you want to test.

### Building for Production

Running `pnpm build` will create a `dist` folder with the final extension files that can be loaded into Chrome as an unpacked extension for testing.

To load the extension in Chrome:
1. Go to chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder