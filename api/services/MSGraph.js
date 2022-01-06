const moment = require("moment-timezone");
const OAuth2 = require("./OAuth2");
// const { from, concat } = require("rxjs");
// const { share, map, filter, concatMap } = require("rxjs/operators");

const baseUrl = "https://graph.microsoft.com/v1.0/users";

module.exports = {
  getCalendarEvents: (
    accessToken,
    email,
    conditions = {
      startDateTime: moment().startOf("date").add(1, "s").format(),
      endDateTime: moment().endOf("date").format(),
      orderBy: "start/dateTime",
    }
  ) => {
    // sails.log('conditions', conditions);
    return MSGraph.requestCalendarView(accessToken, email, conditions);
  },

  requestCalendarView: async (
    accessToken,
    email,
    conditions,
    options = {
      method: "GET",
      headers: {
        Prefer: `outlook.timezone="${MSGraph.getTimeZone()}"`,
      },
    }
  ) => {
    const path = "calendar/calendarView";
    if (!!conditions) {
      options.params = conditions;
    }

    // リクエストとそのレスポンス
    const result = await MSGraph.request(accessToken, email, path, options);
    // return result.data;
    const body = result.data;

    // レスポンス中のイベント
    const first = !!body.value ? body.value : null;

    // レスポンス中に後続リンクがない場合はそのまま返す
    if (!body["@odata.nextLink"]) {
      return first;
    }

    //TODO:後続のマージが正しくできているかチェック★★★★。
    // 後続ありパターンと無いパターンテスト.
    // 後続ありがネストするようなパターンのテスト

    // レスポンス中に後続リンクがある場合
    // リンク先を再帰呼び出しして次の(ページングされた)イベントリストを取得。
    // レスポンス中イベントに追加して返す
    const nextOpt = _.chain(options)
      .omit(["url", "params"]) // 項目を除去
      .extend({ url: body["@odata.nextLink"] }) // URLを追加
      .value();
    const next = await MSGraph.requestCalendarView(
      accessToken,
      email,
      null,
      nextOpt
    );
    return first.concat(next);
  },

  getToken: async () => {
    const token = await OAuth2.getValidToken();
    return { token: token };
  },

  getTokenAndEmail: async (req) => {
    // const roomId = req.param("roomid");
    // const room = await Room.findOne(roomId);
    const token = await OAuth2.getValidToken();
    // return { token: token, email: room.email };//TODO: emailを変数にすること！！
    return { token: token, email: "tokyo9a@liveness.co.jp" };
  },

  request: async (accessToken, email, path, options) => {
    const _options = {
      ...options,
      url: options.url || `${baseUrl}/${email}/${path}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accepts: "application/json",
        "Content-Type": "application/json; charset=utf-8",
        // Prefer: `outlook.timezone="${MSGraph.getTimeZone()}"`,
        ...options.headers,
      },
    };
    sails.log.info(_options);
    return await Http.request(_options);
  },

  getTimeZone: () => sails.config.visitors.timezone || "Asia/Tokyo",
};
