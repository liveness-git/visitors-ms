/**
 * LocationController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

module.exports = {
  choices: async (req, res) => {
    try {
      const Locations = await Location.find().sort("sort ASC");
      return res.json(Locations);
    } catch (err) {
      sails.log.error(err.message);
      return res.status(500).json({ errorMsg: err.message });
    }
  },
  first: async (req, res) => {
    try {
      const Locations = await Location.find().sort("sort ASC");
      return res.json(Locations[0]);
    } catch (err) {
      sails.log.error(err.message);
      return res.status(500).json({ errorMsg: err.message });
    }
  },

  list: async (req, res) => {
    try {
      const result = await Location.find().sort("createdAt ASC");
      return res.json(result);
    } catch (err) {
      sails.log.error(err.message);
      return res.status(500).json({ errorMsg: err.message });
    }
  },

  create: async (req, res) => {
    try {
      const data = req.body.inputs;
      delete data.id;

      // 入力エラーチェック
      const errors = await sails.models.location.inputCheck(data);
      if (!!Object.keys(errors).length) {
        return res.json({ success: false, errors: errors });
      }

      const result = await Location.create(data).fetch();

      if (!!result) {
        return res.json({ success: true });
      } else {
        throw new Error("The update process failed.");
      }
    } catch (err) {
      sails.log.error(err.message);
      return res.status(500).json({ errorMsg: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const data = req.body.inputs;
      const id = data.id;

      // 入力エラーチェック
      const errors = await sails.models.location.inputCheck(data);
      if (!!Object.keys(errors).length) {
        return res.json({ success: false, errors: errors });
      }

      const result = await Location.updateOne(id).set(data);

      if (!!result) {
        return res.json({ success: true });
      } else {
        throw new Error("The update process failed.");
      }
    } catch (err) {
      sails.log.error(err.message);
      return res.status(500).json({ errorMsg: err.message });
    }
  },

  delete: async (req, res) => {
    try {
      const data = req.body.inputs;
      const id = data.id;

      // 削除エラーチェック
      const errors = await sails.models.location.deleteCheck(data);
      if (!!Object.keys(errors).length) {
        return res.json({ success: false, errors: errors });
      }

      const result = await Location.destroyOne(id);

      if (!!result) {
        return res.json({ success: true });
      } else {
        throw new Error("The deletion process failed.");
      }
    } catch (err) {
      sails.log.error(err.message);
      return res.status(500).json({ errorMsg: err.message });
    }
  },
};
