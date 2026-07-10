# Clim

Clim は、現在開いているWebページの情報をショートカットや右クリックから素早くコピーする Chrome 拡張機能です。

URLだけをコピーするシンプルな使い方から、Markdownリンク、引用つきメモ、Frontmatter風のメモまで、テンプレートで出力を自由に作れます。

## 主な機能

- ショートカットスロット1〜4からコピー
- ページ右クリックメニューからURLコピー
- Chromeに保存されているショートカット割り当てを設定画面で表示
- コピー完了トーストのON/OFF
- テンプレートの追加・編集・削除
- 変換ルールと変数ルールの追加
- 初期テンプレート `URLコピー` は削除不可・編集不可
- Markdown、HTML、Scrapbox、Notion向けの編集可能な初期テンプレート
- `{{url}}` や `{{title}}` などのページ情報をテンプレートへ差し込み
- `if` 条件分岐、文字列、`+` 連結に対応

## インストール

1. Chrome で `chrome://extensions` を開く
2. 右上の「デベロッパー モード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」を押す
4. このディレクトリを選択する

## 使い方

Chrome の拡張機能アイコンから Clim をクリックすると、ポップアップが表示されます。

ポップアップから以下を開けます。

- ホームページ
- 設定
- ショートカット

コピー操作は次の方法で行えます。

- ショートカットスロット1: `Alt + Shift + C`
- Macのスロット1: `Control + Shift + C`
- スロット2〜4: `chrome://extensions/shortcuts` で任意に割り当て
- Webページ上で右クリック: `ClimでURLをコピー`

## 設定

設定ページには `設定`、`テンプレート`、`ルールと変数` の3つの画面があります。

`設定` では、現在Chromeに保存されているショートカット割り当てを確認できます。ショートカット表示のボタンを押すと、Chrome標準のショートカット設定画面を開きます。

コピー完了トーストはON/OFFを切り替えできます。頻繁に使う場合はOFFにすると、画面上の通知を抑えられます。

## テンプレート

`テンプレート` ではコピー内容を作成できます。

固定の初期テンプレート:

```txt
URLコピー
{{url}}
```

この初期テンプレートは削除不可・編集不可です。追加したテンプレートは編集・削除できます。

編集可能な初期テンプレート:

- `Markdownリンク`
- `選択引用Markdown`
- `HTMLリンク`
- `Scrapboxリンク`
- `Notionメモ`

テンプレートはショートカットスロット1〜4へ割り当てできます。例えばスロット1はURLコピー、スロット2はMarkdownリンク、スロット3は引用つきメモのように使い分けできます。

## テンプレートで使える値

基本セット:

- `{{url}}`: 現在のURL
- `{{title}}`: `document.title`
- `{{canonicalUrl}}`: canonical URL
- `{{description}}`: meta description
- `{{siteName}}`: OGPのサイト名
- `{{ogTitle}}`: OGPタイトル
- `{{ogDescription}}`: OGP説明文
- `{{ogImage}}`: OGP画像URL
- `{{publishedTime}}`: 記事の公開日時
- `{{modifiedTime}}`: 記事の更新日時
- `{{author}}`: author meta
- `{{lang}}`: ページ言語
- `{{selectedText}}`: 選択中のテキスト
- `{{domain}}`: ドメイン
- `{{date}}`: コピー日
- `{{datetime}}`: コピー日時

初期ルール変数:

- `{{cleanTitle}}`: ページタイトルからサイト名や括弧つきプレフィックスを削ったタイトル
- `{{urlSlug}}`: URLパス末尾をURLデコードし、区切り文字を空白へ寄せた文字列

`ルールと変数` 画面では、値を整える `変換ルール` と、テンプレートで使う `変数` を分けて管理できます。変数は取得元、正規表現、変換ルールを組み合わせて作成します。変数名は基本セットや他の変数と重複できません。

文字列は `"` で囲みます。

```txt
{{"メモ: "}}
```

`+` で連結できます。

```txt
{{title + " - " + url}}
```

`if ... then ... else ...` で条件分岐できます。

```txt
{{if selectedText then "> " + selectedText + "\n\n" else ""}}[{{title}}]({{url}})
```

## テンプレート例

Markdownリンク:

```txt
[{{title}}]({{url}})
```

クリーンタイトルのMarkdownリンク:

```txt
[{{cleanTitle}}]({{url}})
```

タイトルとURL:

```txt
{{title + " " + url}}
```

引用つきMarkdownリンク:

```txt
{{if selectedText then "> " + selectedText + "\n\n" else ""}}[{{title}}]({{url}})
```

メモ用:

```txt
---
title: {{title}}
url: {{url}}
site: {{siteName}}
author: {{author}}
date: {{date}}
---

{{description}}
```

## Chromeウェブストア向け説明

Clim は、現在開いているWebページのURLやタイトル、メタ情報をショートカットや右クリックから素早くコピーするためのChrome拡張機能です。

4つのショートカットスロットを用意しており、Chrome標準のショートカット設定から自由にキーを割り当てできます。コピー内容はテンプレートでカスタマイズでき、URLコピー、Markdownリンク、引用つきメモ、Frontmatter風のメモなど、普段使っているノートアプリやドキュメントに合わせた形式を作成できます。

コピー処理はページ上で完結し、外部サーバーへの送信やリモートコードの実行は行いません。頻繁に使う人向けに、コピー完了トーストのON/OFFも設定できます。

おすすめカテゴリ: 仕事効率化

## 権限について

- `activeTab`: 現在アクティブなタブでコピー処理を実行するため
- `clipboardWrite`: 生成したテキストをクリップボードへ保存するため
- `contextMenus`: 右クリックメニューにコピー項目を追加するため
- `scripting`: 必要なページへコピー用のcontent scriptを注入するため
- `storage`: テンプレート、スロット割り当て、トースト設定を保存するため

## 配布

ZIPで配布する場合は、拡張機能に必要なファイルだけを固めます。

```bash
zip dist/clim-v1.1.0.zip manifest.json README.md icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png icons/icon-source.svg src/background/background.js src/content/content.js src/popup/popup.html src/popup/popup.css src/popup/popup.js src/home/home.html src/home/home.css src/home/home.js src/settings/settings.html src/settings/settings.css src/settings/settings.js
```

## ファイル構成

- `manifest.json`: 拡張機能の設定
- `src/background/background.js`: ショートカットと右クリックメニュー
- `src/content/content.js`: テンプレート評価とクリップボード書き込み
- `src/popup/`: アイコンから開く3択ポップアップ
- `src/home/`: ホームページ
- `src/settings/`: 設定ページとテンプレート管理
- `icons/`: Chrome拡張機能用アイコン
