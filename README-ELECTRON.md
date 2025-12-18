# Desktop App Setup

This application can be run as a desktop app using Electron.

## Development

1. Install dependencies:
```bash
npm install
```

2. In one terminal, start the React dev server:
```bash
npm start
```

3. In another terminal, start the Electron app:
```bash
npm run electron-dev
```

## Building for Production

1. Build the React app:
```bash
npm run build
```

2. Create a desktop app distribution:
```bash
# For your current platform
npm run dist

# Or for specific platforms:
npm run dist-mac    # macOS
npm run dist-win    # Windows
npm run dist-linux  # Linux
```

The built applications will be in the `dist` folder.

## How It Works

- Electron runs the Express server as a child process
- The React app is served by the Express server in production
- In development, Electron loads from the React dev server (localhost:3000)
- All data is stored locally in the `data` folder within the app directory

## Notes

- The server runs on `localhost:3001` internally
- The app window opens automatically when ready
- All existing features work the same as the web version

