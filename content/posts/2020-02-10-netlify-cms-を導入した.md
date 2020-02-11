---
layout: blog
title: Netlify CMS を導入した
date: 2020-02-10T15:23:12.649Z
---
ブラウザ上でブログを書くために `Netlify CMS` を導入してみた。



やり方はこちら。

<https://www.netlifycms.org/docs/add-to-your-site/#configuration>

ブラウザ上でブログを書くと Netlify 側で git に commit/push してくれるらしい。

このブログは [Hugo](https://gohugo.io/) を使ってるんだけどレポジトリそのままではブログ用の html が作られていなくて（`hugo` コマンドで生成しないといけない）、
html の生成も Netlify がやってくれてホスト先に展開してくれるらしい。

https://sharp-turing-842fc1.netlify.com/

ただ github pages 側に反映させるにはまだ一手間必要で(生成した html をリポジトリに入れないといけない）

github pages と Netlify 上に同じブログができたというよく分からない状況になってる。

・・ブログ書くの楽になったのかなこれw

