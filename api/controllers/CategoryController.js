/**
 * CategoryController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

module.exports = {
  choices: async (req, res) => {
    try {
      const $ = await Category.find().sort("sort ASC");
      const categories = $.filter((category) => {
        return (
          category.members === null ||
          category.members.some((email) => email === req.session.user.email)
        );
      });
      return res.json(categories);
    } catch (err) {
      sails.log.error(err.message);
      return res.status(400).json({ body: err.message });
    }
  },
};
