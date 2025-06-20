export const Logger = {
  isHTTP: false,
  log: (...args: unknown[]) => {
    if (Logger.isHTTP) {
      console.log("[INFO]", ...args);
    } else {
      console.error("[INFO]", ...args);
    }
  },
  error: (...args: unknown[]) => {
    console.error("[ERROR]", ...args);
  },
};
