# visitors-ms

## ver.1.0.0 (2022/09/26)

- 初回リリース

## ver.1.0.1 (2022/10/03)

- 受付画面：カテゴリ単位によるビュー切り替えを廃止。
- 受付画面：カテゴリが４つ以上登録されている場合、csv 出力出来ない不具合を修正。
- 受付画面：詳細ダイアログに最終更新日時を追加。

## ver.1.0.2 (2022/12/09)

- 予約の繰り返し機能追加（フロント権限以上）
- ビューの日付選択。前日・翌日アイコンを追加。
- 入力画面の日時ピッカーをプルダウンタイプに変更。
- 入力画面の会議室選択、会議室の説明文表示機能を追加。
- 会議の人数入力、呈茶総数/来訪者/従業員の３パターンに変更。
- 呈茶詳細の入力欄追加。
- 来訪社入力、最大３件まで対応。
- 会議室設定の呈茶デフォルト値、社外/社内それぞれで設定できるよう改修。

## ver.1.0.3 (2022/12/20)

- 清掃オプション機能を追加。
- 予約画面の連絡先にデフォルト値を設定。
- 会議室別画面のカテゴリタブ非表示設定を追加。
- 会議室別画面のタイムバー表示に[8-20]<->[1Day]切替機能を追加。
- 会議室辞退の予約編集で、予約時間を短縮した場合に空き時間検索されない不具合を修正。

## ver.1.0.4 (2022/12/23)

- 予約画面の会議室選択プルダウンに「予約可能な会議室がありません」と一時的に表示される不具合を修正。
- 上記に伴い、会議室選択の問い合わせ時間中はプルダウン選択不可になるよう改修。
- 上記に伴い、会議室選択で連続問い合わせ(request)が発生した場合、request の abort 機能を追加。
- 会議室名表記からメールアドレスの表示を削除。
- 日付ピッカーの挙動不具合を改修。
- GraphAPI の calendar/getSchedule リクエストの不具合に対応。

## ver.1.0.5 (2022/12/28)

- CSV 項目の変更
- ①[予約時間] ⇒[予約日][開始時間][終了時間]に分割。
- ②[イン][カード番号][アウト]非表示。
- ③[予約者所属部署(en)][予約者所属部署(ja)]追加。
- サーバーのエラーログ機能追加

## ver.1.1.0 (2023/01/13)

- Teams 会議招集機能を追加。
- 会議室ごとに予約可能日数を設定。管理者以外はその期間外は予約不可になる機能を追加。
- 23:30 以降の予約を作成した場合、日を跨いだ(翌日まで)予約が可能になる現象を回避。

## ver.1.2.0 (2023/04/20)

- ログイン後の初期画面を会議室別に変更。
- GraphAPI の event 取得の際、パラメーター$select,$top の設定を追加。

## ver.1.3.0 (2023/05/08)

- 空き時間検索で、稼働可能時間も判定条件に追加。
- 会議室別画面のみ Rooms から予約した場合でも表示可能に対応。
- GraphAPI の calendar/getSchedule リクエストを並列処理化。

## ver.1.4.0 (2023/05/18)

- 会議室ごとに予約不可を設定。管理者以外は予約不可になる機能を追加。

## ver.1.5.0 (2023/07/06)

- GraphAPI へのリクエスト不可を軽減するための大幅改修 (パターン１)
  （代表アカウントのアクセストークンによる calender/calenderview 情報取得を個人のアクセストークンへ変更。）
  - 以下の場合のみ代表アカウントのアクセストークンを利用
    　- 登録 / 編集 / 削除
    　- フロント画面表示
    　- 会議室別の Rooms 表示（現在、フロント以上の権限でのみ表示
- アドレス検索。最低 3 文字以上で検索に変更

## ver.1.6.0 (2023/07/18)

- GraphAPI へのリクエスト不可を軽減するための大幅改修 (パターン２)
  （パターン１の個人アクセストークン利用について、代表アカウントの calendar/calendarView 取得の場合のみ
  ロケーションごとの共有アカウントアクセストークンへ変更。）
  - 以下の場合のみ代表アカウントのアクセストークンを利用
    　- 登録 / 編集 / 削除
    　- フロント画面表示
    　- 会議室別の Rooms 表示（現在、フロント以上の権限でのみ表示
    　- 定期予定で詳細選択 → ダイアログで「定期的な予定全体」を選択した場合の情報取得

## ver.1.7.0 (2023/10/26)

- Visitors で登録した会議予約を Rooms で入退室処理した場合、時間の変更が出来なくなるよう仕様変更。

## ver.2.0.beta (2024/01/09)

- GraphAPI のイベント情報をキャッシュ化
- ログイン後の初期ページを production.js で設定可能に変更。
- Rooms 表示のキャッシュ化に不具合あり

## ver.2.0.0 (2024/01/09)

- GraphAPI のイベント情報をキャッシュ化
- ログイン後の初期ページを production.js で設定可能に変更。
