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
};
