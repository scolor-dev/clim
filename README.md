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
- 主要テックサイトの記事見出しを優先したタイトル取得
- 出力テンプレートのカスタマイズ
- サイト別のタイトル取得・削除ルール設定
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

## ホームと設定

拡張機能アイコンをクリックすると、ホームページと設定ページを開けます。

- ホームページ: 使い方、対応フォーマット、ショートカット設定への導線
- 設定ページ: 出力テンプレートとサイト別ルール

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
- note、はてなブログ、クラスメソッド、gihyo、CodeZine、@IT、Speaker Deck、connpass、TECH PLAY、Medium、dev.to: ページタイトルより記事見出しを優先

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

## カスタマイズ設定

拡張機能アイコンをクリックするか、右クリックメニューの `設定ページを開く` から設定画面を開けます。
設定画面では、出力テンプレートとサイト別ルールを編集できます。

### 出力テンプレート

Markdown、Scrapbox、プレーンテキスト、HTMLなどの出力形式をテンプレートで変更できます。

主な変数:

- `{title}`: クリーン済みタイトル
- `{url}`: デコード済みURL
- `{rawTitle}` / `{rawUrl}`: 元のタイトルとURL
- `{selectedText}` / `{quote}`: 選択テキストとMarkdown引用
- `{frontmatter}` / `{markdownMetadata}`: frontmatterやタグ行
- `{author}` / `{tags}` / `{hashtags}` / `{published}` / `{likes}`: 記事メタデータ
- `{owner}` / `{repo}` / `{language}` / `{stars}` / `{kind}` / `{number}` / `{state}`: GitHubメタデータ

### サイト別設定

ドメインごとに、タイトル取得CSSセレクタ、JSON-LD/OGP/document.title fallback、タイトル削除ルールを変更できます。
`*` は全サイト共通のルート設定です。削除はできませんが、内容は編集できます。

- `*`: すべてのドメインに適用
- `zenn.dev`: `zenn.dev` とそのサブドメインに適用
- `zenn.dev, qiita.com`: 複数ドメインに適用
- 削除ルール形式: `regex|正規表現|flags|説明`
- 削除ルール形式: `text|削除文字列||説明`

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
zip dist/clim-v1.1.0.zip manifest.json README.md icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png src/background/background.js src/shared/shared-config.js src/content/clim-utils.js src/content/clim-metadata.js src/content/clim-formatters.js src/content/content.js src/popup/popup.html src/popup/popup.css src/popup/popup.js src/home/home.html src/home/home.css src/home/home.js src/options/options.html src/options/options.css src/options/options.js
```

受け取った人はZIPを展開し、展開したディレクトリを `chrome://extensions` から読み込みます。

Chrome Web Storeで公開する場合は、Chrome Developer DashboardでZIPをアップロードし、ストア掲載情報・プライバシー情報・配布設定を入力して審査に提出します。

## ファイル構成

- `manifest.json`: 拡張機能の設定
- `src/background/background.js`: ショートカット、右クリックメニュー、設定画面の起動
- `src/shared/shared-config.js`: content script と設定画面で共有する既定ルール
- `src/content/clim-utils.js`: クレンジング、エスケープ、JSON-LD/meta取得などの共通処理
- `src/content/clim-metadata.js`: タイトル、著者、タグ、GitHub情報などの取得
- `src/content/clim-formatters.js`: Markdown、Scrapbox、HTML、frontmatter、引用の出力整形
- `src/content/content.js`: コピー処理の入口、クリップボード書き込み、トースト表示
- `src/popup/`: アイコンから開くページ導線
- `src/home/`: ホームページ
- `src/options/`: 出力テンプレートとサイト別ルールの設定画面
- `icons/`: Chrome拡張機能用アイコン
