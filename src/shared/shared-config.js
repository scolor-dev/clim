globalThis.CLIM_DEFAULT_TRIMMING_RULES = [
  {
    id: "global-leading-brackets",
    enabled: true,
    domain: "*",
    type: "regex",
    pattern: "^\\s*(?:【[^】]{1,40}】|\\[[^\\]]{1,40}\\])\\s*",
    flags: "g",
    description: "先頭の【公式】や[対談]などを削除"
  },
  {
    id: "zenn-site-name",
    enabled: true,
    domain: "zenn.dev",
    type: "regex",
    pattern: "\\s*(?:\\||｜|-|ー|--|–|—|·)\\s*Zenn\\s*$",
    flags: "i",
    description: "Zennのサイト名を削除"
  },
  {
    id: "qiita-site-name",
    enabled: true,
    domain: "qiita.com",
    type: "regex",
    pattern: "\\s*(?:\\||｜|-|ー|--|–|—|·)\\s*Qiita\\s*$",
    flags: "i",
    description: "Qiitaのサイト名を削除"
  },
  {
    id: "github-site-name",
    enabled: true,
    domain: "github.com",
    type: "regex",
    pattern: "\\s*(?:\\||｜|-|ー|--|–|—|·)\\s*GitHub\\s*$",
    flags: "i",
    description: "GitHubのサイト名を削除"
  },
  {
    id: "common-japanese-tech-sites",
    enabled: true,
    domain: "*",
    type: "regex",
    pattern: "\\s*(?:\\||｜|-|ー|--|–|—|·)\\s*(?:Note|note|クラスメソッド|DevelopersIO|はてなブログ|Hatena Blog|Speaker Deck|connpass|TECH PLAY|gihyo\\.jp|CodeZine|@IT|Medium|DEV Community|dev\\.to)\\s*$",
    flags: "i",
    description: "よくある技術系サイト名を削除"
  },
  {
    id: "leading-site-name",
    enabled: true,
    domain: "*",
    type: "regex",
    pattern: "^\\s*(?:Zenn|Qiita|Note|note|GitHub|クラスメソッド|DevelopersIO|はてなブログ|Hatena Blog|Speaker Deck|connpass|TECH PLAY|gihyo\\.jp|CodeZine|@IT|Medium|DEV Community|dev\\.to)\\s*(?:\\||｜|-|ー|--|–|—|·)\\s*",
    flags: "i",
    description: "先頭にあるサイト名を削除"
  }
];

globalThis.CLIM_DEFAULT_OUTPUT_TEMPLATES = [
  {
    id: "markdown",
    label: "Markdown",
    template: "[{title}]({url})\n{markdownMetadata}",
    locked: true
  },
  {
    id: "markdownFrontmatter",
    label: "Markdown + frontmatter",
    template: "{frontmatter}\n[{title}]({url})",
    locked: true
  },
  {
    id: "markdownQuote",
    label: "Markdown + quote",
    template: "{quote}\n\n[{title}]({url})\n{markdownMetadata}",
    locked: true
  },
  {
    id: "scrapbox",
    label: "Scrapbox",
    template: "[{title} {url}]",
    locked: true
  },
  {
    id: "plainText",
    label: "プレーンテキスト",
    template: "{title} {url}",
    locked: true
  },
  {
    id: "html",
    label: "HTML",
    template: "<a href=\"{url}\">{title}</a>",
    locked: true
  }
];

globalThis.CLIM_DEFAULT_SITE_SETTINGS = [
  {
    id: "root",
    enabled: true,
    locked: true,
    domain: "*",
    titleSelectors: "",
    useJsonLdTitle: true,
    useOpenGraphTitle: true,
    useDocumentTitle: true,
    trimmingRules: [
      "regex|^\\s*(?:【[^】]{1,40}】|\\[[^\\]]{1,40}\\])\\s*|g|先頭の【公式】や[対談]などを削除",
      "regex|\\s*(?:\\||｜|-|ー|--|–|—|·)\\s*(?:Note|note|クラスメソッド|DevelopersIO|はてなブログ|Hatena Blog|Speaker Deck|connpass|TECH PLAY|gihyo\\.jp|CodeZine|@IT|Medium|DEV Community|dev\\.to)\\s*$|i|よくある技術系サイト名を削除",
      "regex|^\\s*(?:Zenn|Qiita|Note|note|GitHub|クラスメソッド|DevelopersIO|はてなブログ|Hatena Blog|Speaker Deck|connpass|TECH PLAY|gihyo\\.jp|CodeZine|@IT|Medium|DEV Community|dev\\.to)\\s*(?:\\||｜|-|ー|--|–|—|·)\\s*|i|先頭にあるサイト名を削除"
    ].join("\n")
  },
  {
    id: "zenn",
    enabled: true,
    domain: "zenn.dev",
    titleSelectors: "article h1\nmain h1\nh1",
    useJsonLdTitle: true,
    useOpenGraphTitle: true,
    useDocumentTitle: true,
    trimmingRules: "regex|\\s*(?:\\||｜|-|ー|--|–|—|·)\\s*Zenn\\s*$|i|Zennのサイト名を削除"
  },
  {
    id: "qiita",
    enabled: true,
    domain: "qiita.com",
    titleSelectors: "article h1\n[data-testid='article-title']\nmain h1\nh1",
    useJsonLdTitle: true,
    useOpenGraphTitle: true,
    useDocumentTitle: true,
    trimmingRules: "regex|\\s*(?:\\||｜|-|ー|--|–|—|·)\\s*Qiita\\s*$|i|Qiitaのサイト名を削除"
  },
  {
    id: "github",
    enabled: true,
    domain: "github.com",
    titleSelectors: "bdi.js-issue-title\n.js-issue-title\n[data-testid='issue-title']\nspan.js-issue-title\nh1 bdi",
    useJsonLdTitle: false,
    useOpenGraphTitle: true,
    useDocumentTitle: true,
    trimmingRules: "regex|\\s*(?:\\||｜|-|ー|--|–|—|·)\\s*GitHub\\s*$|i|GitHubのサイト名を削除"
  },
  {
    id: "tech-articles",
    enabled: true,
    domain: "note.com, speakerdeck.com, connpass.com, techplay.jp, classmethod.jp, dev.classmethod.jp, gihyo.jp, codezine.jp, atmarkit.itmedia.co.jp, medium.com, dev.to, hatenablog.com, hatena.ne.jp",
    titleSelectors: "article h1\n.entry-title\n.deck-title\nmain h1\nh1",
    useJsonLdTitle: true,
    useOpenGraphTitle: true,
    useDocumentTitle: true,
    trimmingRules: ""
  }
];
