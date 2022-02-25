/**
 * UserController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

module.exports = {
  // セッション中のユーザ情報を取得
  me: async (req, res) => {
    return res.json({
      email: req.session.user.email,
      name: req.session.user.name,
    });
  },
};
