/**
 * CacheController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const MSGraph = require("../services/MSGraph");

module.exports = {
  /**
   * キャッシュ全削除後、指定期間のイベントを全登録
   * @param {*} req
   * @param {*} res
   * @returns
   */
  saveEvents: async (req, res) => {
    try {
      await CronJobs.saveEvents();
      return res.send("Hi there!");
    } catch (err) {
      sails.log.error("CacheController.saveEvents(): ", err.message);
      return MSGraph.errorHandler(res, err);
    }
  },
};
