/**
 * RoomController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

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
      const rooms = await Room.find({ location: location.id }).sort("sort ASC");
      return res.json(rooms);
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ body: err.message });
    }
  },
};