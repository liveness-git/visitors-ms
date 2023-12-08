/**
 * VisitorController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

module.exports = {
  create: async (req, res) => {
    try {
      const data = req.body.inputs;

      const visitor = await Visitor.create(data).fetch();

      if (!!visitor) {
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
      const visitorId = data.visitorId;

      const visitor = await Visitor.updateOne(visitorId).set(data);

      if (!!visitor) {
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
      const visitorId = data.visitorId;
      // visitorの削除
      const visitor = await Visitor.destroyOne(visitorId);
      if (!!visitor) {
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
