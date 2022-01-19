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
        // sails.log.info(message);
      },
      piiLoggingEnabled: false,
      logLevel: msal.LogLevel.Verbose,
    },
  },
};

const requestScopes = ["User.Read", "Calendars.Read", "Calendars.ReadWrite"]; // TODO: これでいいか要確認

const msalApp = new msal.ConfidentialClientApplication(config);

module.exports = {
  requestScopes,
  msalApp,

  acquireToken: async (localAccountId) => {
    const msalTokenCache = msalApp.getTokenCache();
    const account = await msalTokenCache.getAccountByLocalId(localAccountId);
    // Build silent request
    const silentRequest = {
      account: account,
      scopes: requestScopes,
    };
    // Acquire Token Silently to be used in Resource API calll
    return msalApp
      .acquireTokenSilent(silentRequest)
      .then((response) => {
        return response.accessToken;
      })
      .catch((error) => {
        console.log(error);
        return error;
      });
  },
};
