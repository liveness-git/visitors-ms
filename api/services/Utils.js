const { from, of } = require('rxjs');
const { catchError, map } = require('rxjs/operators');

module.exports = {
  /**
   * パスワードチェック
   * @param {*} org 平文のパスワード文字列
   * @param {*} hashed ハッシュ化したパスワード文字列
   * @returns 合っていれば真を返すObservable
   */
  checkPassword: (org, hashed) => {
    return from(sails.helpers.passwords.checkPassword(org, hashed))
    .pipe(
      catchError(() => of(true)),
      map((v) => !v),
    );
  },
};
