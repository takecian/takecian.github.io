# プロ野球 年俸・契約データ PoC

正本は feature の `static/sports-income/`。Hugo が独立パス `/sports-income/` へコピーする。
`public` は master の別checkout。既存サイトのナビやアプリを変更しない。
`Scripts/deploy.sh` は全サイト生成と強制pushを含むため、このPoCの検証・承認前には使わない。

## ローカル確認

```
python3 -m http.server 8765 --bind 127.0.0.1 --directory static
node --test tests/sports-income.test.cjs
PLAYWRIGHT_MODULE=/tmp/sports-income-test-tools/node_modules/playwright node tests/sports-income-browser.cjs
hugo --destination /tmp/sports-income-hugo-preview --cacheDir /tmp/sports-income-hugo-cache --noBuildLock
```

プレビュー: `http://127.0.0.1:8765/sports-income/`。
ブラウザーテストはMacのインストール済みChromeをヘッドレス起動する。別環境では `CHROMIUM_PATH` を指定する。
Playwrightはテスト専用で、アプリの実行時依存・外部サービスはない。

## データ仕様 v2

`data.json`: schemaVersion=2、checkedAt、players、archivedPlayers、sourceCatalog。
表示対象は sport=baseball、league=NPB / MLB。旧4選手は archivedPlayers に元の内容を保持し、UIでは表示しない。
現状はNPB2選手、MLB3選手の少数検証サンプルであり全選手・全年度を網羅しない。

選手の records はUI用の金額行、events は加入・契約履歴。各行の sources に媒体・URL・公開/確認日・取得制約を保持する。
MLBの annualRecords に2024〜2026年の9件の契約上の年額と当年支払予定・繰延額を保持し、contractEvents に契約条件の構造化情報も残す。
UIには媒体名、タイトル、URL、出典件数、取得過程を表示しない。報道金額は「報道などから推測」と表示し、契約成立の公式発表と区別する。

金額行には year / season / team / kind / currency / amount / precision / status / sources を持つ。

- kind: salary、scheduled-payment、deferred-compensation、signing-bonus、conditional-bonus、multi-year-total等。
- currency: JPY（保存は円）/ USD（保存はドル）。表示時に億＋万円／億＋万ドルへ変換し、小数を保持。換算・通貨横断合計・順位は作らない。
- precision: exact（報道の記載額も含む）、lower-bound（bound=gt/gte）、undisclosed。
- status: estimated / official / undisclosed / unknown。確認できない金額は amount=null。資料で裏付けられたゼロのみ数値0を許す。
- multi-year-total には period.start / period.end。契約金が総額に含まれるか、支払日、条件は注記・メタデータで保持。

MLBは報道された契約上の予定であり、実際の入金ではない。MLB全金額行の actualPaid=null / actualPaidStatus=not_verified を維持する。
大谷の7000万ドルは後払い込みの名目年額。当年支払予定200万ドル、当年分の繰延6800万ドルはJSONの原本情報として保持し、UIでは非表示。
大谷の繰延支払予定は2034〜2043年の各7月1日。契約期間中に繰り延べる額と将来に支払う額を混合しない。
山本の給与後払いなしは報道に基づく0。鈴木の後払い・当年支払予定は未確認のためnullとする。
契約総額を年数で割って観測年俸にせず、契約金や条件付き報酬を年俸に加算しない。
球団間ポスティング料は contractEvents.postingFee に isPlayerIncome=false として保持し、選手の金額表・グラフから除外する。

## グラフ

グラフは salary のみ表示。scheduled-payment / deferred-compensation はデータとして保持し、表・グラフ・読み上げ情報では非表示。USD/JPYは別グラフ。
exact の単年データだけ点を描く。年度の飛び、null、下限は線で補間せず、複数年総額・一時金も描かない。
全点0の場合も有限座標で描画する。グラフ軸とツールチップに原通貨と金額の定義を明示する。

## 検証範囲

検索・リーグ/所属・空結果・年度選択・戻る・キーボード・空/異常データ・旧競技非表示・出典非表示・通貨と報酬種別の分離を検証。
320/375/768/1280pxの横はみ出しを確認。画面画像は `/tmp/sports-income-baseball-*.png`。
金額の主要な原本確認結果は sourceCatalog の independentVerification に保持する。全資料の再取得や自動更新は行わない。

年度表は同じ年度・シーズン・所属・通貨を1行にし、年俸・契約金・条件付き報酬・期間付き契約総額を列表示する。合計は計算しない。契約金は記録のある年だけ置き、支払年不明の場合はその年基準を注記。年度列は横スクロール時も固定する。
