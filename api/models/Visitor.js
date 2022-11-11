/**
 * Visitor.js
 *
 * @description :: A model definition represents a database table/collection.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

module.exports = {
  attributes: {
    //  ╔═╗╦═╗╦╔╦╗╦╔╦╗╦╦  ╦╔═╗╔═╗
    //  ╠═╝╠╦╝║║║║║ ║ ║╚╗╔╝║╣ ╚═╗
    //  ╩  ╩╚═╩╩ ╩╩ ╩ ╩ ╚╝ ╚═╝╚═╝
    iCalUId: { type: "string", required: true },
    usageRange: {
      type: "string",
      isIn: ["outside", "inside"],
      defaultsTo: "outside",
    },
    visitCompany: { type: "json" },
    // ↑ の中身は以下の通り {
    // name: { type: "string" },
    // rep: { type: "string" },
    // }
    numberOfVisitor: { type: "number", required: true, min: 0 },
    numberOfEmployee: { type: "number", required: true, min: 0 },
    resourcies: { type: "json", required: true },
    // ↑ の中身は以下の通り
    // <room.id>:{
    // teaSupply: { type: "boolean", defaultsTo: false },
    // numberOfTeaSupply: { type: "number", required: true, min: 0 },
    // teaDetails: { type: "string" },
    // }
    comment: { type: "string" },
    contactAddr: { type: "string" },
    checkIn: { type: "string" },
    checkOut: { type: "string" },
    visitorCardNumber: { type: "string" },

    eventType: {
      type: "string",
      isIn: ["singleInstance", "occurrence", "exception", "seriesMaster"],
      required: true,
    },
    seriesMasterICalUId: { type: "string" }, // 定期イベントのInstancesのみ

    //  ╔═╗╔╦╗╔╗ ╔═╗╔╦╗╔═╗
    //  ║╣ ║║║╠╩╗║╣  ║║╚═╗
    //  ╚═╝╩ ╩╚═╝╚═╝═╩╝╚═╝

    //  ╔═╗╔═╗╔═╗╔═╗╔═╗╦╔═╗╔╦╗╦╔═╗╔╗╔╔═╗
    //  ╠═╣╚═╗╚═╗║ ║║  ║╠═╣ ║ ║║ ║║║║╚═╗
    //  ╩ ╩╚═╝╚═╝╚═╝╚═╝╩╩ ╩ ╩ ╩╚═╝╝╚╝╚═╝
  },
};
