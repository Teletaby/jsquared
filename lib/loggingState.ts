// In-memory store for logging state (in production, use database)
const loggingState = {
  isLoggingEnabled: true,
};

export function isLoggingEnabled() {
  return loggingState.isLoggingEnabled;
}

export function setLoggingEnabled(enabled: boolean) {
  loggingState.isLoggingEnabled = enabled;
}

export function getLoggingState() {
  return loggingState;
}
