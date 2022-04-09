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
    visitCompany: { type: "string", required: true },
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

    //  ╔═╗╔╦╗╔╗ ╔═╗╔╦╗╔═╗
    //  ║╣ ║║║╠╩╗║╣  ║║╚═╗
    //  ╚═╝╩ ╩╚═╝╚═╝═╩╝╚═╝

    //  ╔═╗╔═╗╔═╗╔═╗╔═╗╦╔═╗╔╦╗╦╔═╗╔╗╔╔═╗
    //  ╠═╣╚═╗╚═╗║ ║║  ║╠═╣ ║ ║║ ║║║║╚═╗
    //  ╩ ╩╚═╝╚═╝╚═╝╚═╝╩╩ ╩ ╩ ╩╚═╝╝╚╝╚═╝
  },
};
