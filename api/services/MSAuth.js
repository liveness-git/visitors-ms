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

const requestScopes = [
  "User.Read",
  "User.Read.All",
  "Calendars.Read",
  "Calendars.ReadWrite",
  // "Contacts.Read", //for contacts
]; // TODO: これでいいか要確認

const msalApp = new msal.ConfidentialClientApplication(config);

module.exports = {
  requestScopes,
  msalApp,

  acquireToken: async (localAccountId) => {
    const msalTokenCache = msalApp.getTokenCache();
    const account = await msalTokenCache.getAccountByLocalId(localAccountId);
    const silentRequest = {
      account: account,
      scopes: requestScopes,
    };
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