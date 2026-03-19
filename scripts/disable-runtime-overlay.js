const fs = require('fs');
const path = require('path');

const marker = 'runtime overlay disabled by local patch';
const devServerMarker = 'dev server client overlay disabled by local patch';

function resolveWebpackHotDevClient() {
  const configPath = require.resolve('react-scripts/config/webpackDevServer.config.js');
  const reactScriptsDir = path.dirname(path.dirname(configPath));
  return path.join(
    reactScriptsDir,
    '..',
    'react-dev-utils',
    'webpackHotDevClient.js'
  );
}

function resolveWebpackDevServerConfig() {
  return require.resolve('react-scripts/config/webpackDevServer.config.js');
}

function patchRuntimeOverlay(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  if (source.includes(marker)) {
    return false;
  }

  const target = `var hadRuntimeError = false;
ErrorOverlay.startReportingRuntimeErrors({
  onError: function () {
    hadRuntimeError = true;
  },
  filename: '/static/js/bundle.js',
});`;

  const replacement = `var hadRuntimeError = false;
// ${marker}
// External browser extensions can throw cross-origin runtime errors during development.
// Keep the dev server running without the full-screen overlay for those cases.`;

  if (!source.includes(target)) {
    throw new Error('Unable to locate runtime overlay block in webpackHotDevClient.js');
  }

  fs.writeFileSync(filePath, source.replace(target, replacement));
  return true;
}

function patchDevServerOverlay(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  if (source.includes(devServerMarker)) {
    return false;
  }

  const target = `      overlay: {
        errors: true,
        warnings: false,
      },`;

  const replacement = `      overlay: {
        // ${devServerMarker}
        errors: false,
        warnings: false,
      },`;

  if (!source.includes(target)) {
    throw new Error('Unable to locate client.overlay block in webpackDevServer.config.js');
  }

  fs.writeFileSync(filePath, source.replace(target, replacement));
  return true;
}

const clientPath = resolveWebpackHotDevClient();
const devServerConfigPath = resolveWebpackDevServerConfig();
const runtimeChanged = patchRuntimeOverlay(clientPath);
const devServerChanged = patchDevServerOverlay(devServerConfigPath);

console.log(
  runtimeChanged
    ? `Patched runtime overlay: ${clientPath}`
    : `Runtime overlay already patched: ${clientPath}`
);
console.log(
  devServerChanged
    ? `Patched dev-server client overlay: ${devServerConfigPath}`
    : `Dev-server client overlay already patched: ${devServerConfigPath}`
);
