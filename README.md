# clim

日本のWebサイト向けにタイトルとURLを整形し、MarkdownリンクとしてコピーするChrome拡張のMVPです。
拡張機能のUIを開かず、ショートカットキーだけで処理が完結します。

## 構成

- `manifest.json`: 拡張機能の設定
- `background.js`: ショートカットキーを受け取るService Worker
- `content.js`: タイトル/URL取得、クレンジング、クリップボード書き込み、トースト表示

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
ショートカットが他の機能と衝突する場合は、`chrome://extensions/shortcuts` から変更できます。

## 処理内容

- 日本語URLエンコードを `decodeURIComponent()` でデコード
- `| Zenn`, `- Qiita`, `｜クラスメソッド` などのサイト名ノイズを除去
- `【2026年最新】`, `[対談]`, `【公式】` などの先頭メタ情報を除去
- 全角英数字を半角化
- コピー完了時に画面右下へ1秒だけ小さなトーストを表示
