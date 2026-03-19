import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const DEV_OVERLAY_SELECTORS = [
  '#webpack-dev-server-client-overlay',
  '#webpack-dev-server-client-overlay-div',
];

function isExtensionErrorMessage(message = '') {
  return message.includes('Origin not allowed');
}

function isExtensionSource(value = '') {
  return value.includes('chrome-extension://') || value.includes('moz-extension://');
}

function shouldIgnoreExternalRuntimeError(payload) {
  if (!payload) return false;

  const message = String(payload.message || payload.reason?.message || '');
  const filename = String(payload.filename || '');
  const stack = String(payload.error?.stack || payload.reason?.stack || '');

  return (
    isExtensionErrorMessage(message) &&
    (isExtensionSource(filename) || isExtensionSource(stack))
  );
}

function hideDevOverlayElement(element) {
  if (!(element instanceof HTMLElement)) return;
  if (!DEV_OVERLAY_SELECTORS.some((selector) => element.matches(selector))) return;
  element.style.setProperty('display', 'none', 'important');
  element.remove();
}

function installDevOverlaySuppressor() {
  if (typeof document === 'undefined') return;

  const style = document.createElement('style');
  style.setAttribute('data-local-dev-overlay-hide', 'true');
  style.textContent = DEV_OVERLAY_SELECTORS.map(
    (selector) => `${selector} { display: none !important; }`
  ).join('\n');
  document.head.appendChild(style);

  const hideExisting = () => {
    document
      .querySelectorAll(DEV_OVERLAY_SELECTORS.join(','))
      .forEach((element) => hideDevOverlayElement(element));
  };

  hideExisting();

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        hideDevOverlayElement(node);
        DEV_OVERLAY_SELECTORS.forEach((selector) => {
          node.querySelectorAll(selector).forEach((element) => hideDevOverlayElement(element));
        });
      });
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (typeof window !== 'undefined') {
  if (process.env.NODE_ENV !== 'production') {
    installDevOverlaySuppressor();
  }

  window.addEventListener(
    'error',
    (event) => {
      if (!shouldIgnoreExternalRuntimeError(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (!shouldIgnoreExternalRuntimeError(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
