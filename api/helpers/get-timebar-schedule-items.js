module.exports = {
  friendlyName: "Get Timebar scheduleItems",

  description: "Timebar表示用のscheduleItemsの形に成型します",

  inputs: {
    scheduleItems: {
      type: "ref",
      description: "GraphAPIのscheduleItems情報",
      required: true,
    },
  },

  fn: async function (inputs, exits) {
    const result = inputs.scheduleItems.reduce((result, item) => {
      // Timebarで重複表示しないよう表示位置(列)を決める
      let targetIndex = _.findIndex(result, (searchRow) => {
        // 各表示位置の最終要素を取得
        const lastItem = _.last(searchRow);
        // 最終要素の終了時間とcurrent要素の開始時間を比較
        return (
          !!lastItem &&
          lastItem.end <= MSGraph.getTimestamp(item.start.dateTime)
        );
      });

      const newItem = {
        status: item.status,
        start: MSGraph.getTimestamp(item.start.dateTime),
        end: MSGraph.getTimestamp(item.end.dateTime),
      };

      if (targetIndex < 0) {
        result.push([newItem]); // 重複表示 → 新たに表示位置(列)を追加
      } else {
        result[targetIndex].push(newItem);
      }
      return result;
    }, []);

    return exits.success(result);
  },
};
