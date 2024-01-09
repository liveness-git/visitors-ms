/**
 * Category.js
 *
 * @description :: A model definition represents a database table/collection.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

module.exports = {
  attributes: {
    //  ╔═╗╦═╗╦╔╦╗╦╔╦╗╦╦  ╦╔═╗╔═╗
    //  ╠═╝╠╦╝║║║║║ ║ ║╚╗╔╝║╣ ╚═╗
    //  ╩  ╩╚═╩╩ ╩╩ ╩ ╩ ╚╝ ╚═╝╚═╝
    name: { type: "string", required: true },
    sort: { type: "string" },
    limitedPublic: { type: "boolean", defaultsTo: false },
    members: { type: "json", columnType: "array", required: true },
    // ↑ の中身は以下の通り
    // {
    // name: { type: "string", required: true },
    // address: { type: "string", required: true },
    // }
    disabledByRoom: { type: "boolean", defaultsTo: false },

    //  ╔═╗╔╦╗╔╗ ╔═╗╔╦╗╔═╗
    //  ║╣ ║║║╠╩╗║╣  ║║╚═╗
    //  ╚═╝╩ ╩╚═╝╚═╝═╩╝╚═╝

    //  ╔═╗╔═╗╔═╗╔═╗╔═╗╦╔═╗╔╦╗╦╔═╗╔╗╔╔═╗
    //  ╠═╣╚═╗╚═╗║ ║║  ║╠═╣ ║ ║║ ║║║║╚═╗
    //  ╩ ╩╚═╝╚═╝╚═╝╚═╝╩╩ ╩ ╩ ╩╚═╝╝╚╝╚═╝
    rooms: { collection: "room" },
    eventCaches: { collection: "eventcache" },
  },

  inputCheck: async (data) => {
    const errors = {};

    return errors;
  },

  deleteCheck: async (data) => {
    const errors = {};

    const associations = await Room.find({ category: data.id });
    if (associations.length) {
      errors.name = ["settings.form.common.error.association"];
    }

    return errors;
  },
};
