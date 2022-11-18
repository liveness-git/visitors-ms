const { map } = require("p-iteration");

module.exports = {
  friendlyName: "Create Visitor Instances",

  description:
    "渡されたseriesMasterIdに紐づくevent(Instances)を取得し、visitorに登録します。",

  inputs: {
    accessToken: {
      type: "string",
      description: "graphAPI問合わせ用accessToken",
      required: true,
    },
    email: {
      type: "string",
      description: "graphAPI問合わせ用email",
      required: true,
    },
    seriesMasterId: {
      type: "string",
      description: "seriesMasterId",
      required: true,
    },
    newData: {
      type: "ref",
      description: "登録するvisitorの情報",
      required: true,
    },
  },

  fn: async function (inputs, exits) {
    // seriesMasterからinstancesを取得
    const events = await MSGraph.getEventsBySeriesMasterId(
      inputs.accessToken,
      inputs.email,
      inputs.seriesMasterId
    );
    // instances分をvisitorを登録
    const result = await map(events, async (event) => {
      return await Visitor.create({
        ...inputs.newData,
        iCalUId: event.iCalUId,
        eventType: event.type,
      }).fetch();
    });

    return exits.success(result);
  },
};
