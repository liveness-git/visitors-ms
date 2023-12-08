/**
 * OauthController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const MSAuth = require("../services/MSAuth");
const { map } = require("p-iteration");

// Create msal application object
const cca = MSAuth.msalApp;
const redirectUri = sails.config.visitors.credential.redirectUri;
const shareAccounts = [...sails.config.visitors.credential.shareAccounts];

module.exports = {
  signin: async (req, res) => {
    try {
      const authCodeUrlParameters = {
        scopes: MSAuth.requestScopes,
        redirectUri: redirectUri,
      };

      // 認可エンドポイントに認可リクエストを投げる。
      cca
        .getAuthCodeUrl(authCodeUrlParameters)
        .then((response) => {
          // 未認可の場合、認可画面urlを取得。
          return res.json({ url: response });
        })
        .catch((error) => {
          sails.log.error("OauthController.signin(): ", error);
          res.status(500).send(error);
        });
    } catch (err) {
      sails.log.error("OauthController.signin(): ", err.message);
      return res.status(400).json({ body: err.message });
    }
  },

  redirect: async (req, res) => {
    try {
      const tokenRequest = {
        code: req.query.code, // 認可コード
        scopes: MSAuth.requestScopes,
        redirectUri: redirectUri,
      };

      //トークンエンドポイントに認可コードを提示。
      cca
        .acquireTokenByCode(tokenRequest)
        .then(async (response) => {
          const admin = await Role.findOne({ name: "admin" });
          const front = await Role.findOne({ name: "front" });

          // ユーザーのセッション情報をセット
          // ※Adminロールが作成されていない場合は、Admin権限を無条件true
          req.session.user = {
            email: response.account.username,
            name: response.account.name,
            isAdmin:
              !admin ||
              (!!admin &&
                admin.members.some(
                  (user) => user.address === response.account.username
                )),
            isFront:
              !!front &&
              front.members.some(
                (user) => user.address === response.account.username
              ),
            localAccountId: response.account.localAccountId,
            contactAddr: undefined,
            entity: undefined,
          };

          // ログインユーザーのユーザー情報を取得
          const $ = await MSGraph.request(
            response.accessToken,
            req.session.user.email,
            "",
            {
              method: "GET",
              params: {
                $select:
                  "businessPhones,displayName,givenName,jobTitle,mobilePhone,officeLocation,preferredLanguage,surname,userPrincipalName,id,department",
              },
            }
          );
          const user = $.data;
          delete user["@odata.context"];

          // ユーザーの連絡先デフォルト値が設定されてる場合
          const getDefaultOfContactAddr =
            sails.config.visitors.getDefaultOfContactAddr;
          if (getDefaultOfContactAddr !== undefined) {
            req.session.user.contactAddr = getDefaultOfContactAddr(user); // セッションに保存
          }

          // graphAPIのユーザー情報をセッションに保存
          req.session.user.entity = _.cloneDeep(user);

          // 代表アカウントも同時に設定
          const localAccountId = await MSAuth.acquireOwnerAccountId();
          req.session.owner = { localAccountId: localAccountId };

          // 共有アカウントも同時に設定
          req.session.share = await map(shareAccounts, async (share) => {
            const localAccountId = await MSAuth.acquireShareAccountId(
              share.username,
              share.password
            );
            return {
              location: share.location,
              email: share.username,
              localAccountId: localAccountId,
            };
          });

          return res.json({ ok: true });
        })
        .catch((error) => {
          sails.log.error("OauthController.redirect(): ", error);
          res.status(500).send(error);
        });
    } catch (err) {
      sails.log.error("OauthController.redirect(): ", err.message);
      return res.status(400).json({ body: err.message });
    }
  },

  signout: async (req, res) => {
    try {
      if (!req.session.user) {
        return res.ok();
      }

      // msal内のキャッシュ削除 (Azure側のサインアウトは別途対応が必要）
      const msalTokenCache = cca.getTokenCache();
      const account = await msalTokenCache.getAccountByLocalId(
        req.session.user.localAccountId
      );
      msalTokenCache.removeAccount(account);

      req.session.user = null;

      return res.ok();
    } catch (err) {
      sails.log.error("OauthController.signout(): ", err.message);
      return res.status(400).json({ body: err.message });
    }
  },
};
