# 非公開のローカル閲覧資料

このディレクトリはHugoの `content/`・`static/`・`assets/` および公開成果物 `public/` の外です。通常のHugoビルドの公開対象に含めない保守資料です。

## NEEDLES

`needles/index.html` をローカルのブラウザで直接開いてください。通常モデルの公式画像12枚と手動保存した別注画像14枚、26配色のデータ、出典一覧、画像の手動追加手順を含みます。詳しくは `needles/開き方と画像追加.txt` を参照してください。

取得済み画像は私的閲覧用です。GitHubリポジトリがprivateであることを確認して保存しています。フォルダや画像を `static/`・`content/`・`public/` へコピーしないでください。リポジトリをpublicへ戻す場合は、この画像を含むGit履歴も公開されるため、公開前に履歴の扱いを別途検討してください。

画像取得の制約はprivate化しても変わりません。mix.tokyo由来の別注画像は自動取得していません。B’2nd 4色・L.H.P 6色・BEAVER 4色はユーザーが保存した画像を追加済みです。既存の公開ページ・公開方法はこの変更では変更していません。

## 公開経路の確認（2026-10-31）

- `feature` に `.github/workflows/` はありません。
- Actions APIで確認できたworkflowは `dynamic/pages/pages-build-deployment` のみ。
- private化前のPages公開元は `master` の `/`。private化後のPages APIは404。
- `Scripts/deploy.sh` はHugo生成後に `public/` 内の変更だけをmasterへpushする構成。この作業では実行していません。
- `config.toml` にこのディレクトリを公開するmount/staticDir/contentDirの指定はありません。layouts/Scriptsにもこのディレクトリを読み込む処理はありません。
- 公開用masterブランチは変更せず、featureだけへ通常pushします。
