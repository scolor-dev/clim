# clim

日本のWebサイト向けにタイトルとURLを整形し、Markdown、Scrapbox、プレーンテキスト、HTMLリンクとしてコピーするChrome拡張のMVPです。
拡張機能のUIを開かず、ショートカットキーだけで処理が完結します。

## 構成

- `manifest.json`: 拡張機能の設定
- `background.js`: ショートカットキーを受け取るService Worker
- `content.js`: タイトル/URL取得、クレンジング、クリップボード書き込み、トースト表示
- `options.html` / `options.css` / `options.js`: ドメインごとのトリミング設定画面

## ローカルで読み込む

1. Chrome で `chrome://extensions` を開く
2. 右上の「デベロッパー モード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」を押す
4. このディレクトリを選択する

読み込み後、任意のWebページで以下のショートカットを押すと、Markdownリンクがクリップボードにコピーされます。

- Windows/Linux: `Alt + Shift + C`
- Mac: `Control + Shift + C`

```md
[クリーンなタイトル](デコード済みのURL)
```

変更後は `chrome://extensions` で拡張機能の更新ボタンを押してください。
ショートカットが他の機能と衝突する場合や、他形式を使いたい場合は、Chromeで `chrome://extensions/shortcuts` を開いて変更できます。

## 右クリックメニュー

Webページ上で右クリックすると、`climでクリーンコピー` メニューから出力形式を選んでコピーできます。
ショートカットを覚えていない時や、マウス操作だけで完結したい時に使えます。

## トリミング設定

拡張機能アイコンをクリックするか、右クリックメニューの `トリミング設定を開く` から設定画面を開けます。
ドメインごとに、文字列または正規表現で削除ルールを追加できます。

- `*`: すべてのドメインに適用
- `zenn.dev`: `zenn.dev` とそのサブドメインに適用
- `regex`: 正規表現として削除
- `text`: 入力した文字列をそのまま削除

## 対応フォーマット

| コマンド | 出力例 | 初期ショートカット |
| --- | --- | --- |
| Markdown | `[タイトル](URL)` | Windows/Linux: `Alt + Shift + C`, Mac: `Control + Shift + C` |
| Scrapbox | `[タイトル URL]` | 未割り当て |
| プレーンテキスト | `タイトル URL` | 未割り当て |
| HTML | `<a href="URL">タイトル</a>` | 未割り当て |

## メタデータ補完

Markdown形式では、主要テックサイトの情報を自動で補完します。

- Zenn/Qiita: 著者名とタグをリンク直下に追加
- GitHubリポジトリ: タイトル末尾に主要言語とStar数を追加
- GitHub Issue/PR: タイトル末尾に種別とOpen/Closed状態を追加

```md
[記事タイトル](https://zenn.dev/example/articles/example)
@example #Rust #React
```

## 処理内容

- 日本語URLエンコードを `decodeURIComponent()` でデコード
- 設定画面のトリミングルールに基づいてサイト名ノイズや先頭メタ情報を除去
- 全角英数字を半角化
- コピー完了時に画面右下へ1秒だけ小さなトーストを表示
