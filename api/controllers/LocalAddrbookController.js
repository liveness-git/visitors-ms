/**
 * LocalAddrbookController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const MSAuth = require("../services/MSAuth");
const MSGraph = require("../services/MSGraph");

module.exports = {
  addressbook: async (req, res) => {
    try {
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ errors: err.message });
    }
  },

  import: async (req, res) => {
    try {
      // msalから有効なaccessToken取得(代表)
      const ownerToken = await MSAuth.acquireToken(
        req.session.owner.localAccountId
      );

      const params = {
        $select: "displayName,mail,givenName,surname",
        $top: 500,
      };

      // GraphAPIからアドレス情報を取得
      const contacts = await MSGraph.getDataValues(
        ownerToken,
        sails.config.visitors.credential.username,
        "",
        {
          url: MSGraph.baseUrl,
          method: "GET",
          params: params,
        }
      );

      // 会議室情報を取得
      const rooms = await Room.find();

      // mongoDBから一旦すべて消す
      await LocalAddrbook.destroy({});

      // mongoDBへ保存
      let count = 0;
      for (let i = 0; i < contacts.length; i++) {
        const user = contacts[i];
        if (
          // 代表アカウント/会議室は表示対象外
          user.mail === sails.config.visitors.credential.username ||
          rooms.find((room) => room.email === user.mail)
        ) {
          return;
        }
        // save
        const result = await LocalAddrbook.create({
          displayName: user.displayName,
          mail: user.mail,
          givenName: !!user.givenName ? user.givenName : "",
          surname: !!user.surname ? user.surname : "",
        }).fetch();

        if (!!result) {
          count++;
        }
      }

      return res.json(`${count}件のアドレス情報を保存しました`);
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ errors: err.message });
    }
  },
};
