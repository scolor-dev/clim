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
    pattern: "\\s*(?:\\||｜|-|ー|--|–|—|·)\\s*(?:Note|note|クラスメソッド|DevelopersIO|はてなブログ|Hatena Blog|Speaker Deck|connpass|TECH PLAY)\\s*$",
    flags: "i",
    description: "よくある技術系サイト名を削除"
  },
  {
    id: "leading-site-name",
    enabled: true,
    domain: "*",
    type: "regex",
    pattern: "^\\s*(?:Zenn|Qiita|Note|note|GitHub|クラスメソッド|DevelopersIO|はてなブログ|Hatena Blog|Speaker Deck|connpass|TECH PLAY)\\s*(?:\\||｜|-|ー|--|–|—|·)\\s*",
    flags: "i",
    description: "先頭にあるサイト名を削除"
  }
];
