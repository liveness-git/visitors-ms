/**
 * OauthController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const MSAuth = require("../services/MSAuth");

// Create msal application object
const cca = MSAuth.createMsalAppObject();
const redirectUri = sails.config.visitors.credential.redirectUri;

module.exports = {
  signin: async (req, res) => {
    try {
      const authCodeUrlParameters = {
        scopes: ["user.read"], // TODO: これでいいか要確認
        redirectUri: redirectUri,
      };

      // 認可エンドポイントに認可リクエストを投げる。
      cca
        .getAuthCodeUrl(authCodeUrlParameters)
        .then((response) => {
          // 未認可の場合、認可画面urlを取得。
          return res.json({ url: response });
        })
        .catch((error) => console.log(JSON.stringify(error)));
    } catch (err) {
      return res.status(400).json({ body: err.message });
    }
  },

  redirect: async (req, res) => {
    try {
      const tokenRequest = {
        code: req.query.code, // 認可コード
        scopes: ["user.read"], // TODO: これでいいか要確認
        redirectUri: redirectUri,
      };

      //トークンエンドポイントに認可コードを提示。
      cca
        .acquireTokenByCode(tokenRequest)
        .then((response) => {
          req.session.user = {
            email: response.account.username,
            name: response.account.name,
            accessToken: response.accessToken,
          };
          return res.json({ ok: true });
        })
        .catch((error) => {
          console.log(error);
          res.status(500).send(error);
        });
    } catch (err) {
      return res.status(400).json({ body: err.message });
    }
  },

  signout: (req, res) => {
    if (!req.session.user) {
      return res.ok();
    }
    // TODO:msal内のキャッシュ削除とAZUL側のサインアウト
    // const accounts = cca.getTokenCache().getAllAccounts();
    // // filter on the account that you want to delete from the cache.
    // // I take the first one here to keep the code sample short
    // const account = accounts[0];
    // cca.getTokenCache().removeAccount(account);

    req.session.user = null;

    return res.ok();
  },
};
