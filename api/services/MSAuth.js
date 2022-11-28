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
  "OrgContact.Read.All", //TODO: sails.config.visitors.contactAddr
]; // TODO: Azureと同じ設定

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

  // 代表アカウントのlocalAccountIdを取得
  acquireOwnerAccountId: async () => {
    // msalのトークンキャッシュ内に代表アカウントが既にあるか調べる
    const msalTokenCache = msalApp.getTokenCache();
    const accounts = await msalTokenCache.getAllAccounts();
    const owner = accounts.find(
      (ac) => ac.username === sails.config.visitors.credential.username
    );

    if (owner) {
      return owner.localAccountId;
    } else {
      // キャッシュにない場合はOAuth認証処理して情報取得
      const usernamePasswordRequest = {
        scopes: MSAuth.requestScopes,
        username: sails.config.visitors.credential.username,
        password: sails.config.visitors.credential.password,
      };
      return msalApp
        .acquireTokenByUsernamePassword(usernamePasswordRequest)
        .then((response) => {
          return response.account.localAccountId;
        })
        .catch((error) => {
          console.log(error);
        });
    }
  },
};
