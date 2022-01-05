const moment = require("moment-timezone");
const Http = require("./Http");

module.exports = {
  getValidToken: async () => {
    await OAuth2.cleanup();
    token = await OAuth2.findValidToken();
    return !token ? OAuth2.getToken() : token;
  },

  getToken: async () => {
    const credential = sails.config.visitors.credential;

    // ROPC形式でトークンを取得する。
    const url = `https://login.microsoftonline.com/${credential.tenant_id}/oauth2/v2.0/token`;
    const form = {
      client_id: credential.client_id,
      grant_type: "password",
      username: credential.username,
      password: credential.password,
      scope: [
        "Calendars.Read",
        "Calendars.Read.Shared",
        "Calendars.ReadWrite",
        "Calendars.ReadWrite.Shared",
        "Directory.AccessAsUser.All",
        "Mail.Send",
      ].join(" "),
    };
    const options = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };

    const res = await Http.postForm(url, form, options);
    const $ = res.data;
    const exp = moment().add($.expires_in, "seconds");
    const token = { ...$, expires_at: exp.unix() };
    // mongoにトークン情報を登録後、同情報を返す
    return await OAuth2Token.create(token).fetch();
  },

  cleanup: async () => {
    return OAuth2Token.destroy({
      where: {
        expires_at: { "<=": moment().unix() },
      },
    });
  },

  findValidToken: async (min = 5) => {
    const limit = moment().add(min, "minutes");
    const token = await OAuth2Token.find({
      // where: {
      expires_at: { ">": limit.unix() },
      // }
    });
    return !!token && token.length > 0 ? token[token.length - 1] : null;
  },
};
