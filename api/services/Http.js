const axios = require("axios");
const formurlencode = require("form-urlencoded");

module.exports = {
  request: async (options) => {
    return await axios(options);
  },

  get: async (url, options) => {
    return await axios.get(url, options);
  },

  postForm: async (url, form, options) => {
    sails.log.info(url, formurlencode(form), options);
    return await axios.post(url, formurlencode(form), options);
  },
};
