// const { from, of } = require("rxjs");
// const { map, tap, concatMap, take } = require("rxjs/operators");
const moment = require("moment-timezone");
const Http = require("./Http");

module.exports = {
  getValidToken: async () => {
    await OAuth2.cleanup();
    token = await OAuth2.findValidToken();
    return !token ? OAuth2.getToken() : token;
    // TODO:確認後、削除
    // return OAuth2.cleanup().pipe(
    //   concatMap(() => OAuth2.findValidToken()),
    //   concatMap((token) => (!token ? OAuth2.getToken() : of(token)))
    // );
  },

  getToken: async () => {
    const credential = sails.config.visitors.front.credential;

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

    // TODO:確認後、削除
    // return Http.postForm(url, form, options).pipe(
    //   map((res) => res.data),
    //   map((token) => {
    //     const exp = moment().add(token.expires_in, 'seconds');
    //     return {...token, 'expires_at': exp.unix()};
    //   }),
    //   concatMap((token) => from(OAuth2Token.create(token).fetch())),
    // );
  },

  cleanup: async () => {
    return OAuth2Token.destroy({
      where: {
        expires_at: { "<=": moment().unix() },
      },
    });
    // TODO:確認後、削除
    // return from(OAuth2Token.destroy({
    //   where: {
    //     'expires_at': { '<=': moment().unix() },
    //   },
    // }));
  },

  findValidToken: async (min = 5) => {
    const limit = moment().add(min, "minutes");
    const token = await OAuth2Token.find({
      // where: {
      expires_at: { ">": limit.unix() },
      // }
    });
    return !!token && token.length > 0 ? token[token.length - 1] : null;

    // TODO:確認後、削除
    // return from(
    //   OAuth2Token.find({
    //     // where: {
    //     expires_at: { ">": limit.unix() },
    //     // }
    //   })
    // ).pipe(
    //   // tap($ => sails.log('oauth2 token', $)),
    //   map(($) => (!!$ && $.length > 0 ? $[$.length - 1] : null))
    // );
  },
};
