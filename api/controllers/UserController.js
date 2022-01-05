/**
 * UserController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

module.exports = {
  // セッション中のユーザ名を取得
  me: async (req, res) => {
    return res.json(req.session.user.name);
  },
  // セッション中のメールアドレスを取得
  email: async (req, res) => {
    return res.json(req.session.user.email);
  },
};
