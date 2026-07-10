# Clim

Clim は、日本語Webページ向けのクリーンなリンク生成ツールを育てるための Chrome 拡張機能です。

現在は内部処理を最小にし、現在のページURLをそのままコピーする構成にしています。

## 現在の構成

- 3択ポップアップ
- ホームページ
- 設定ページ
- ホームページとポップアップからショートカット設定への導線
- ショートカットで現在のページURLをコピー
- Webページ上の右クリックメニューで現在のページURLをコピー
- コピー処理はURLを加工せず、そのままクリップボードへ保存

## インストール

1. Chrome で `chrome://extensions` を開く
2. 右上の「デベロッパー モード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」を押す
4. このディレクトリを選択する

## 使い方

Chrome の拡張機能アイコンから Clim をクリックすると、ポップアップが表示されます。

ポップアップとホームページから以下を開けます。

- ホームページ
- 設定
- ショートカット

現在のページURLは、次の操作でコピーできます。

- ショートカット: `Alt + Shift + C`
- Mac: `Control + Shift + C`
- Webページ上で右クリック: `ClimでURLをコピー`

## 配布

ZIPで配布する場合は、拡張機能に必要なファイルだけを固めます。

```bash
zip dist/clim-v1.1.0.zip manifest.json README.md icons/icon-16.png icons/icon-32.png icons/icon-48.png icons/icon-128.png icons/icon-source.svg src/background/background.js src/content/content.js src/popup/popup.html src/popup/popup.css src/popup/popup.js src/home/home.html src/home/home.css src/home/home.js src/settings/settings.html src/settings/settings.css
```

## ファイル構成

- `manifest.json`: 拡張機能の設定
- `src/background/background.js`: ショートカットと右クリックメニュー
- `src/content/content.js`: 現在URLのコピー処理
- `src/popup/`: アイコンから開く3択ポップアップ
- `src/home/home.html`: ホームページ
- `src/home/home.css`: ホームページのスタイル
- `src/home/home.js`: ホームページから設定とショートカットを開く処理
- `src/settings/`: 設定ページ
- `icons/`: Chrome拡張機能用アイコン
