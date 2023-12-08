/**
 * RoleController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

module.exports = {
  list: async (req, res) => {
    try {
      const result = await Role.find().sort("createdAt ASC");
      return res.json(result);
    } catch (err) {
      sails.log.error(err.message);
      return res.status(500).json({ errorMsg: error.message });
    }
  },

  create: async (req, res) => {
    try {
      const data = req.body.inputs;
      delete data.id;

      // 入力エラーチェック
      const errors = await sails.models.role.inputCheck(data);
      if (!!Object.keys(errors).length) {
        return res.json({ success: false, errors: errors });
      }

      const result = await Role.create(data).fetch();

      if (!!result) {
        return res.json({ success: true });
      } else {
        throw new Error("The update process failed.");
      }
    } catch (err) {
      sails.log.error(err.message);
      return res.status(500).json({ errorMsg: error.message });
    }
  },

  update: async (req, res) => {
    try {
      const data = req.body.inputs;
      const id = data.id;

      // 入力エラーチェック
      const errors = await sails.models.role.inputCheck(data);
      if (!!Object.keys(errors).length) {
        return res.json({ success: false, errors: errors });
      }

      const result = await Role.updateOne(id).set(data);

      if (!!result) {
        return res.json({ success: true });
      } else {
        throw new Error("The update process failed.");
      }
    } catch (err) {
      sails.log.error(err.message);
      return res.status(500).json({ errorMsg: error.message });
    }
  },

  delete: async (req, res) => {
    try {
      const data = req.body.inputs;
      const id = data.id;

      // 削除エラーチェック
      const errors = await sails.models.role.deleteCheck(data);
      if (!!Object.keys(errors).length) {
        return res.json({ success: false, errors: errors });
      }

      const result = await Role.destroyOne(id);

      if (!!result) {
        return res.json({ success: true });
      } else {
        throw new Error("The deletion process failed.");
      }
    } catch (err) {
      sails.log.error(err.message);
      return res.status(500).json({ errorMsg: error.message });
    }
  },
};
