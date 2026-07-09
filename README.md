# clim

clim は、日本語WebページのタイトルとURLをクリーンに整形してコピーする Chrome 拡張機能です。
ショートカットキーや右クリックメニューから、Markdown、Scrapbox、プレーンテキスト、HTML形式のリンクをすばやく作れます。

日本語URLのデコード、サイト名ノイズの除去、全角英数字の半角化に加えて、Zenn / Qiita / GitHub 向けのメタデータ補完にも対応しています。

## 主な機能

- UIを開かずにショートカットだけでコピー
- 右クリックメニューから出力形式を選択
- Markdown / Scrapbox / プレーンテキスト / HTML に対応
- 選択テキストをMarkdown引用としてコピー
- Zenn / Qiita の著者・タグ・frontmatter補完
- GitHubリポジトリの言語・Star数、Issue/PRの状態を補完
- ドメインごとのカスタムトリミングルール

## インストール

1. Chrome で `chrome://extensions` を開く
2. 右上の「デベロッパー モード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」を押す
4. このディレクトリを選択する

更新後は `chrome://extensions` で clim の更新ボタンを押してください。

## 使い方

Markdownリンクは初期ショートカットでコピーできます。

- Windows/Linux: `Alt + Shift + C`
- Mac: `Control + Shift + C`

```md
[クリーンなタイトル](デコード済みのURL)
```

ショートカットの変更や、他形式へのキー割り当ては Chrome で `chrome://extensions/shortcuts` を開いて行えます。

## 対応フォーマット

| 形式 | 出力例 | 初期ショートカット |
| --- | --- | --- |
| Markdown | `[タイトル](URL)` | Windows/Linux: `Alt + Shift + C`, Mac: `Control + Shift + C` |
| Markdown + quote | `> 選択テキスト` + `[タイトル](URL)` | 未割り当て |
| Markdown + frontmatter | `--- ... ---` + `[タイトル](URL)` | 未割り当て |
| Scrapbox | `[タイトル URL]` | 未割り当て |
| プレーンテキスト | `タイトル URL` | 未割り当て |
| HTML | `<a href="URL">タイトル</a>` | 未割り当て |

## 右クリックメニュー

Webページ上で右クリックすると、`climでクリーンコピー` から出力形式を選べます。
ショートカットを覚えていない時や、マウス操作だけで完結したい時に使えます。

## 選択テキスト引用

`Markdown + quote` では、ページ上で選択しているテキストをMarkdown引用としてリンク前に追加します。

```md
> 選択した記事の中の重要な文章

[クリーンなタイトル](デコード済みのURL)
```

## メタデータ補完

Markdown形式では、主要テックサイト向けにメタデータを補完します。

- 通常Markdown: Zenn/Qiita の著者名とタグをリンク直下に追加
- Markdown + frontmatter: Zenn/Qiita のタイトル、著者名、タグ、いいね数、公開日、URLをfrontmatterとして追加
- GitHubリポジトリ: タイトル末尾に主要言語とStar数を追加
- GitHub Issue/PR: タイトル末尾に種別とOpen/Closed状態を追加

```md
---
title: "記事タイトル"
author: @example
tags: [Rust, React]
likes: 120
published: 2026-07-09
url: https://zenn.dev/example/articles/example
---
[記事タイトル](https://zenn.dev/example/articles/example)
```

## トリミング設定

拡張機能アイコンをクリックするか、右クリックメニューの `トリミング設定を開く` から設定画面を開けます。
ドメインごとに、文字列または正規表現でタイトルから削除するルールを追加できます。

- `*`: すべてのドメインに適用
- `zenn.dev`: `zenn.dev` とそのサブドメインに適用
- `zenn.dev, qiita.com`: 複数ドメインに適用
- `regex`: 正規表現として削除
- `text`: 入力した文字列をそのまま削除

## 整形内容

clim はコピー時に以下の整形を行います。

- 日本語URLエンコードを `decodeURIComponent()` でデコード
- 設定画面のトリミングルールに基づいてサイト名ノイズや先頭メタ情報を除去
- 全角英数字を半角化
- コピー完了時に画面右下へ1秒だけ小さなトーストを表示

## 配布

手元で使うだけなら、このリポジトリを `chrome://extensions` から「パッケージ化されていない拡張機能」として読み込めます。

ZIPで配布する場合は、拡張機能に必要なファイルだけを固めます。

```bash
zip dist/clim-v1.0.0.zip manifest.json background.js shared-config.js content.js README.md options.html options.css options.js icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png
```

受け取った人はZIPを展開し、展開したディレクトリを `chrome://extensions` から読み込みます。

Chrome Web Storeで公開する場合は、Chrome Developer DashboardでZIPをアップロードし、ストア掲載情報・プライバシー情報・配布設定を入力して審査に提出します。

## ファイル構成

- `manifest.json`: 拡張機能の設定
- `background.js`: ショートカット、右クリックメニュー、設定画面の起動
- `shared-config.js`: content script と設定画面で共有する既定ルール
- `content.js`: タイトル/URL取得、クレンジング、メタデータ抽出、クリップボード書き込み
- `options.html` / `options.css` / `options.js`: トリミング設定画面
- `icons/`: Chrome拡張機能用アイコン
