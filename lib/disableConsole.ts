// Global console override for production
export function disableConsoleInProduction() {
  const disableDevTools = process.env.DISABLE_DEV_TOOLS !== 'false';

  if (process.env.NODE_ENV === 'production' && disableDevTools) {
    // Disable all console methods
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
    console.info = () => {};
    console.debug = () => {};
    console.table = () => {};
    console.group = () => {};
    console.groupEnd = () => {};
    console.time = () => {};
    console.timeEnd = () => {};

    // Clear any existing console output
    console.clear();

    // Block dev tools with comprehensive keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+I (Dev Tools)
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+C (Inspect)
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+K (Console - Firefox)
      if (e.ctrlKey && e.shiftKey && (e.key === 'K' || e.key === 'k')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+U (View Source)
      if (e.ctrlKey && e.key === 'U') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // F11 (Fullscreen - can be used to hide dev tools)
      if (e.key === 'F11') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }, true);

    // Block context menu
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }, true);

    // Detect and attempt to close dev tools
    let devtoolsOpen = false;
    const threshold = 160;

    const detectDevTools = () => {
      if (window.outerHeight - window.innerHeight > threshold || window.outerWidth - window.innerWidth > threshold) {
        if (!devtoolsOpen) {
          devtoolsOpen = true;
          // Attempt to close dev tools by focusing window
          window.focus();
          // Clear console again
          console.clear();
        }
      } else {
        devtoolsOpen = false;
      }
    };

    // Check for dev tools periodically
    setInterval(detectDevTools, 500);

    // Override window.open to prevent new windows
    const originalOpen = window.open;
    window.open = function(url, target, features) {
      // Allow legitimate navigation but block suspicious patterns
      if (url && typeof url === 'string' && (url.includes('chrome-devtools://') || url.includes('devtools://'))) {
        return null;
      }
      return originalOpen.call(this, url, target, features);
    };

    // Prevent access to chrome dev tools APIs
    if (typeof window !== 'undefined') {
      // @ts-expect-error - Intentionally overriding window.chrome to block dev tools access
      window.chrome = window.chrome || {};
      // @ts-expect-error - Intentionally setting chrome.devtools to undefined to block dev tools
      window.chrome.devtools = undefined;
    }

    // Add visual warning overlay when dev tools detected
    const createWarning = () => {
      const warning = document.createElement('div');
      warning.id = 'devtools-warning';
      warning.innerHTML = `
        <div style="
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.9);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999;
          font-family: Arial, sans-serif;
          font-size: 24px;
          text-align: center;
          padding: 20px;
        ">
          <div>
            <h2>⚠️ Developer Tools Detected</h2>
            <p>Please close developer tools to continue using this application.</p>
            <p>This action has been logged.</p>
          </div>
        </div>
      `;
      document.body.appendChild(warning);
      return warning;
    };

    // Monitor for dev tools and show warning
    let warningElement: HTMLElement | null = null;
    const checkDevTools = () => {
      const isOpen = window.outerHeight - window.innerHeight > threshold ||
                    window.outerWidth - window.innerWidth > threshold;

      if (isOpen) {
        if (!warningElement) {
          warningElement = createWarning();
        }
        // Log the attempt (you might want to send this to your server)
        console.log('Dev tools access attempt detected');
      } else {
        if (warningElement) {
          warningElement.remove();
          warningElement = null;
        }
      }
    };

    // Check every 100ms for dev tools
    setInterval(checkDevTools, 100);

    // Prevent debugger statements
    Object.defineProperty(window, 'debugger', {
      get: () => {
        console.log('Debugger access blocked');
        return undefined;
      },
      set: () => {
        console.log('Debugger modification blocked');
      }
    });
  }
}
