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
    visitCompany: { type: "string" },
    visitorName: { type: "string" },
    resourcies: { type: "json", required: true },
    // ↑ の中身は以下の通り
    // <room.id>:{
    // teaSupply: { type: "boolean", defaultsTo: false },
    // numberOfVisitor: { type: "number", required: true, min: 0 },
    // numberOfEmployee: { type: "number", required: true, min: 0 },
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
