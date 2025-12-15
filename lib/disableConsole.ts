// Global console override for production
export function disableConsoleInProduction() {
  if (process.env.NODE_ENV === 'production') {
    // Disable all console methods
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
    console.info = () => {};
    console.debug = () => {};
  }
}
