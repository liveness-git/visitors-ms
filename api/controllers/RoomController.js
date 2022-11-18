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
      const criteria = {};

      // 対象ロケーションをセット
      const location = await Location.findOne({ url: req.query.location });
      criteria.location = location.id;

      // 対象利用範囲の指定があった場合
      if (!!req.query.usagerange) {
        criteria.usageRange = [req.query.usagerange, "none"];
      }

      // タイプの指定があった場合
      if (!!req.query.type) {
        criteria.type = req.query.type;
      }

      // 会議室一覧(仮)の取得
      const $rooms = await Room.find(criteria).sort("sort ASC");

      // 会議室一覧(仮)からカテゴリの表示権限による絞り込み
      const rooms = await filter($rooms, async (room) => {
        // 特定会議室と同一カテゴリの会議室だけ集める場合
        if (!!req.query.samecategory) {
          const targetRoom = await Room.findOne(req.query.samecategory);
          if (room.category !== targetRoom.category) {
            return false;
          }
        }

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

      // 該当会議室がない場合
      if (rooms.length === 0) {
        return res.json(rooms);
      }

      // 空き時間検索が不要な場合
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

      // 削除エラーチェック
      const errors = await sails.models.room.deleteCheck(data);
      if (!!Object.keys(errors).length) {
        return res.json({ success: false, errors: errors });
      }

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
