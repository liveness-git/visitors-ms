/**
 * VisitorController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const MSGraph = require("../services/MSGraph");

module.exports = {
  create: async (req, res) => {
    try {
      return res.ok;
    } catch (err) {
      // sails.log.error(err.message);
      return res.status(400).json({ body: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const data = req.body;
      const visitorId = data.visitorId;

      const visitor = await Visitor.updateOne(visitorId).set(data);

      if (!!visitor) {
        return res.json({ success: true });
      } else {
        return res.json({ success: false });
      }
    } catch (err) {
      // sails.log.error(err.message);
      return res.status(400).json({ errors: err.message });
    }
  },

  delete: async (req, res) => {
    try {
      const data = req.body;
      const visitorId = data.visitorId;
      // visitorの削除
      const visitor = await Visitor.destroyOne(visitorId);
      if (!!visitor) {
        return res.json({ success: true });
      } else {
        return res.json({ success: false });
      }
    } catch (err) {
      // sails.log.error(err.message);
      return res.status(400).json({ errors: err.message });
    }
  },
};
