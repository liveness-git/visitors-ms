/**
 * RoomController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const MSAuth = require("../services/MSAuth");
const MSGraph = require("../services/MSGraph");
const { filter } = require("p-iteration");

module.exports = {
  list: async (req, res) => {
    try {
      return res.json("ok");
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ body: err.message });
    }
  },
  choices: async (req, res) => {
    try {
      const location = await Location.findOne({ url: req.query.location });
      const $rooms = await Room.find({ location: location.id }).sort(
        "sort ASC"
      );
      const rooms = await filter($rooms, async (room) => {
        const category = await Category.findOne(room.category);
        return (
          category.members === null ||
          category.members.some((email) => email === req.session.user.email)
        );
      });

      if (!req.query.start || !req.query.end) {
        return res.json(rooms);
      }

      // 空き時間検索
      // msalから有効なaccessToken取得
      const accessToken = await MSAuth.acquireToken(
        req.session.user.localAccountId
      );

      // graphAPIから空き会議室を取得
      const available = await MSGraph.getAvailableRooms(
        accessToken,
        req.session.user.email,
        Number(req.query.start),
        Number(req.query.end),
        rooms.map((room) => room.email)
      );
      const result = rooms.filter((room) => {
        const $ = available.filter((av) => av === room.email);
        return $.length > 0;
      });

      return res.json(result);
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ body: err.message });
    }
  },
};
