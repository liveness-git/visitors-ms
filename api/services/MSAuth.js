const msal = require("@azure/msal-node");

const credential = sails.config.visitors.credential;

const config = {
  auth: {
    clientId: credential.client_id,
    authority: `${credential.cloud_instance_Id}/${credential.tenant_id}`,
    clientSecret: credential.client_secret,
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel, message, containsPii) {
        // console.log(message);
      },
      piiLoggingEnabled: false,
      logLevel: msal.LogLevel.Verbose,
    },
  },
};

module.exports = {
  createMsalAppObject: () => {
    // Create msal application object
    return new msal.ConfidentialClientApplication(config);
  },
};
