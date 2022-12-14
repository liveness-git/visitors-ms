/**
 * CategoryController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const { filter } = require("p-iteration");

module.exports = {
  choices: async (req, res) => {
    try {
      const $ = await Category.find().sort("sort ASC");

      // 公開範囲のフィルタリング
      let categories = $.filter((category) => {
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

      // locationが設定されている場合
      if (!!req.query.location) {
        // 会議室別のカテゴリタブの場合、非表示カテゴリは対象から外す
        if (req.query.tab === "byroom") {
          categories = categories.filter(
            (category) => !category.disabledByRoom
          );
        }
        // カテゴリに紐づく会議室が該当ロケーションに存在する場合のみ表示
        categories = await filter(categories, async (category) => {
          // ロケーションの取得
          const location = await Location.findOne({ url: req.query.location });
          // 会議室の取得
          const rooms = await Room.find({
            location: location.id,
            category: category.id,
          });
          return rooms.length > 0;
        });
      }

      return res.json(categories);
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ body: err.message });
    }
  },

  list: async (req, res) => {
    try {
      const result = await Category.find().sort("createdAt ASC");
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
      const errors = await sails.models.category.inputCheck(data);
      if (!!Object.keys(errors).length) {
        return res.json({ success: false, errors: errors });
      }

      const result = await Category.create(data).fetch();

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
      const errors = await sails.models.category.inputCheck(data);
      if (!!Object.keys(errors).length) {
        return res.json({ success: false, errors: errors });
      }

      const result = await Category.updateOne(id).set(data);

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
      const errors = await sails.models.category.deleteCheck(data);
      if (!!Object.keys(errors).length) {
        return res.json({ success: false, errors: errors });
      }

      const result = await Category.destroyOne(id);

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
