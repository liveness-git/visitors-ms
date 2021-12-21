/**
 * TestController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const MSGraph = require("../services/MSGraph");
const OAuth2 = require("../services/OAuth2");

module.exports = {
  testX: async (req, res) => {
    try {
      return res.json({ ok: true });
    } catch (err) {
      return res.status(400).json({ body: err.message });
    }
  },

  // getTodaysEvents: async (req, res) => {
  test: async (req, res) => {
    try {
      const $ = await MSGraph.getTokenAndEmail(req);
      const events = await MSGraph.getCalendarEvents(
        $.token.access_token,
        $.email
      );
      return res.json(events);
    } catch (err) {
      return res.status(400).json({ body: err.message });
    }
    // .pipe(
    //   concatMap(($) =>
    //     MSGraph.getCalendarEvents($.token.access_token, $.email)
    //   ),
    //   reduce((acc, event) => {
    //     // sails.log.info('Add event to array', event, acc.length);
    //     acc.push(event);
    //     return acc;
    //   }, []),
    //   // tap((events) => sails.log.info('Got events', events)),
    //   map((events) => res.json(events))
    // )
    // .toPromise();
  },
};
