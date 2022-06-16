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
      return res.status(400).json({ body: err.message });
    }
  },
  first: async (req, res) => {
    try {
      const Locations = await Location.find().sort("sort ASC");
      return res.json(Locations[0]);
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ body: err.message });
    }
  },

  list: async (req, res) => {
    try {
      const result = await Location.find().sort("createdAt ASC");
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

      const result = await Location.create(data).fetch();

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

      const result = await Location.updateOne(id).set(data);

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

      const result = await Location.destroyOne(id);

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
