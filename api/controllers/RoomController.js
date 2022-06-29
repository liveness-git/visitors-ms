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
  choices: async (req, res) => {
    try {
      const location = await Location.findOne({ url: req.query.location });
      const $rooms = await Room.find({ location: location.id }).sort(
        "sort ASC"
      );
      const rooms = await filter($rooms, async (room) => {
        const category = await Category.findOne(room.category);
        // admin権限の場合は無条件に表示
        if (req.session.user.isAdmin) {
          return true;
        }
        // カテゴリが全員公開 or 限定公開の場合は対象者であるかチェック
        return (
          !category.limitedPublic ||
          category.members.some(
            (user) => user.address === req.session.user.email
          )
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

  list: async (req, res) => {
    try {
      const result = await Room.find().sort("createdAt ASC");
      return res.json(result);
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ body: err.message });
    }
  },

  create: async (req, res) => {
    try {
      const data = req.body.inputs;
      delete data.id;

      // 入力エラーチェック
      const errors = await sails.models.room.inputCheck(data);
      if (!!Object.keys(errors).length) {
        return res.json({ success: false, errors: errors });
      }

      const result = await Room.create(data).fetch();

      if (!!result) {
        return res.json({ success: true });
      } else {
        throw new Error("The update process failed.");
      }
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ body: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const data = req.body.inputs;
      const id = data.id;

      // 入力エラーチェック
      const errors = await sails.models.room.inputCheck(data);
      if (!!Object.keys(errors).length) {
        return res.json({ success: false, errors: errors });
      }

      const result = await Room.updateOne(id).set(data);

      if (!!result) {
        return res.json({ success: true });
      } else {
        throw new Error("The update process failed.");
      }
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ errors: err.message });
    }
  },

  delete: async (req, res) => {
    try {
      const data = req.body.inputs;
      const id = data.id;

      const result = await Room.destroyOne(id);

      if (!!result) {
        return res.json({ success: true });
      } else {
        throw new Error("The deletion process failed.");
      }
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ errors: err.message });
    }
  },
};
