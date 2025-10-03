const isProd = process.env.NODE_ENV === "production";

export function log(...args) {
  if (!isProd) console.log("[LOG]", ...args);
}

export function error(...args) {
  console.error("[ERR]", ...args);
}

export default { log, error };
