const fs = require("node:fs");

/** Adds the Firebase file when it's available: on EAS through a file variable, locally beside this file. */
module.exports = ({ config }) => {
  const local = "./google-services.json";
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON ?? (fs.existsSync(local) ? local : undefined);
  return { ...config, android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) } };
};
