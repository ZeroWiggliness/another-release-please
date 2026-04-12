const debugEnabled = process.env.ARP_DEBUG === 'true';

export let isDebug = debugEnabled;

export function setDebug(enabled: boolean) {
  isDebug = enabled;
}

export function info(...args: any[]) {
  // Write info messages to stdout (which is reserved for JSON payloads on stderr)
  console.info(...args);
}

export function warn(...args: any[]) {
  console.warn(...args);
}

export function error(...args: any[]) {
  console.error(...args);
}

export function debug(...args: any[]) {
  if (isDebug) {
    // Write debug to stdout when enabled
    // tslint:disable-next-line:no-console
    console.debug(...args);
  }
}
