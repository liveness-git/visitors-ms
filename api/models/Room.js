/**
 * Room.js
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
    email: { type: "string", required: true, unique: true },
    sort: { type: "string" },
    usageRange: {
      type: "string",
      isIn: ["none", "outside", "inside"],
      defaultsTo: "none",
    },
    type: { type: "string", isIn: ["rooms", "free"], defaultsTo: "rooms" },
    teaSupply: { type: "boolean", defaultsTo: false },

    //  ╔═╗╔╦╗╔╗ ╔═╗╔╦╗╔═╗
    //  ║╣ ║║║╠╩╗║╣  ║║╚═╗
    //  ╚═╝╩ ╩╚═╝╚═╝═╩╝╚═╝

    //  ╔═╗╔═╗╔═╗╔═╗╔═╗╦╔═╗╔╦╗╦╔═╗╔╗╔╔═╗
    //  ╠═╣╚═╗╚═╗║ ║║  ║╠═╣ ║ ║║ ║║║║╚═╗
    //  ╩ ╩╚═╝╚═╝╚═╝╚═╝╩╩ ╩ ╩ ╩╚═╝╝╚╝╚═╝
    location: { model: "location" },
    category: { model: "category" },
  },

  inputCheck: async (data) => {
    const errors = {};

    const unique = await Room.findOne({ email: data.email });
    if (unique && unique.id !== data.id) {
      errors.email = ["settings.form.room.error.email.unique"];
    }

    return errors;
  },

  deleteCheck: async (data) => {
    const errors = {};

    return errors;
  },
};
