# AGENTS.md

このファイルは、AI エージェント（Antigravity 等）がこのリポジトリで作業を行う際のガイドラインおよび手順書です。

## 概要

このリポジトリは **Hugo** を使用した静的ウェブサイトのソースコード管理および公開用リポジトリです。

### ブランチ構造
- **`feature` ブランチ**: ビルド前のソースコード（Hugo の設定ファイル `config.toml`、記事 `content/`、テーマ `themes/` など）を管理するブランチ。通常のエージェント作業はこのブランチで行います。
- **`master` ブランチ (または `main`)**: GitHub Pages で公開されるビルド済みの静的成果物 (`public/` ディレクトリ配下) を管理する公開用ブランチ。

---

## ディレクトリ構成と連携

- `content/`: 記事やページのソース（Markdownファイル）
- `public/`: `hugo` コマンドによって生成されるビルド成果物。Git サブモジュールまたは独立したリポジトリ参照として `master` ブランチに結びついています。
- `Scripts/deploy.sh`: Hugo のビルドと `public/` 内での `master` ブランチへの自動デプロイを行うスクリプト。

---

## 開発作業手順 (Workflow for Agents)

### 1. リポジトリの準備・セットアップ
作業を開始する際は、現在 `feature` ブランチ上にいること、および `public` ディレクトリがサブモジュールとして正しく初期化されていることを確認してください。

```bash
git checkout feature
git submodule update --init --recursive
```

### 2. 新規ページの作成 (Create New Entry)
新しい記事を作成する場合は `hugo new` コマンドを使用します。

```bash
hugo new posts/YYYY-MM-DD_title.md
```
* 例: `hugo new posts/2026-08-31_diary.md`
* 生成されたファイルは `content/posts/` ディレクトリ配下に作成されます。
* 記事のヘッダー (Front Matter) で `draft: false` になっているか確認・編集してください（`draft: true` のままだと通常ビルドに含まれません）。

### 3. ローカルプレビュー (Preview)
作成・編集した記事をローカル環境で確認する場合は `hugo server` を起動します。

```bash
hugo server -D
```
* `-D` オプションにより、ドラフト状態 (`draft: true`) の記事もプレビュー可能です。
* ローカルサーバーは通常 `http://localhost:1313/` で確認できます。

### 4. ビルドとデプロイ (Build & Deploy)
記事の執筆および動作確認が完了したら、サイトのビルドと公開を行います。

#### ① GitHub Pages (master ブランチ) へのデプロイ
```bash
./Scripts/deploy.sh
```
※ または `sh Scripts/deploy.sh`

`Scripts/deploy.sh` は内部で以下の処理を連続して行います:
1. `hugo` コマンドを実行して `public/` に静的ファイルを生成。
2. `public/` ディレクトリに移動し、全変更を `git add .` および `git commit -m "Update"`。
3. `git push -f origin master` で GitHub Pages 公開用ブランチへ強制プッシュ。
4. 元のディレクトリに戻る。

#### ② ソースコード (feature ブランチ) の保存
サイト更新後、ビルド前のソースコード変更分を `feature` ブランチにコミットしてプッシュします。

```bash
git add .
git commit -m "Add post YYYY-MM-DD"
git push origin feature
```

---

## 注意事項 (Important Notes)

- **直接 `master` ブランチで編集しないこと**: ソースコードの編集は必ず `feature` ブランチで行ってください。
- **デプロイスクリプトのパス**: ルートにある `README.md` に `./deply.sh` と誤記されている場合がありますが、正しいスクリプトパスは `./Scripts/deploy.sh` です。
- **ドラフト設定 (`draft`)**: 公開時は記事ファイル内の `draft: false` であることを確認してからデプロイスクリプトを実行してください。
