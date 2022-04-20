/**
 * UserController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const MSAuth = require("../services/MSAuth");
const MSGraph = require("../services/MSGraph");

module.exports = {
  // セッション中のユーザ情報を取得
  me: async (req, res) => {
    return res.json({
      email: req.session.user.email,
      name: req.session.user.name,
    });
  },

  addressbook: async (req, res) => {
    try {
      // msalから有効なaccessToken取得
      const accessToken = await MSAuth.acquireToken(
        req.session.user.localAccountId
      );

      const params = {
        $select: "displayName,mail",
        $top: 30,
      };
      if (req.query.filter) {
        params.$filter = `startsWith(displayName,'${req.query.filter}') or startsWith(mail,'${req.query.filter}') `;
      }

      // 名前検索結果の取得
      const $ = await MSGraph.request(accessToken, req.session.user.email, "", {
        url: MSGraph.baseUrl,
        method: "GET",
        params: params,
      });
      const contacts = $.data.value;
      const result = contacts.map((user) => {
        const name = user.displayName;
        const address = user.mail;
        return {
          name: name,
          address: address,
        };
      });

      return res.json(result);
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ errors: err.message });
    }
  },
};
