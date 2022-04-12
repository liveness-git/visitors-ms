module.exports = {
  friendlyName: "Generate Visitor Resourcies",

  description:
    "渡されたResourcies情報(FormData)をmongoに登録するResourcies情報に変換して返します。",

  inputs: {
    resourcies: {
      type: "ref",
      description: "FormDataのResourcies情報",
      required: true,
    },
  },

  fn: async function (inputs, exits) {
    const resourcies = inputs.resourcies;
    const roomId = Object.keys(resourcies)[0]; //TODO:複数会議室未対応

    const result = {
      [resourcies[roomId].roomForEdit]: {
        teaSupply: resourcies[roomId].teaSupply,
        numberOfVisitor: Number(resourcies[roomId].numberOfVisitor),
        numberOfEmployee: Number(resourcies[roomId].numberOfEmployee),
      },
    };

    return exits.success(result);
  },
};
