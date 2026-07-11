# 株式会社トライテック コーポレートサイト

[https://tritechinc.jp](https://tritechinc.jp)

## 概要

株式会社トライテックのコーポレートサイト。SES・品質保証・DX支援の3事業紹介、採用情報、メディア（公式SNS）案内、お問い合わせフォームを提供。

## 技術スタック

- **HTML / CSS / Vanilla JavaScript** (フレームワーク不使用)
- **GitHub Pages** によるホスティング
- **Google Apps Script + Microsoft Graph API** によるお問い合わせフォーム送信 (`info@tritechinc.jp` として送信・DMARC対応)
- **Google reCAPTCHA v3** によるスパム対策
- **Google Analytics 4** によるアクセス解析
- **DNS**: お名前.com (`tritechinc.jp`)
- **メール**: Microsoft 365 + Google Workspace SPF (`info@tritechinc.jp`)

## ページ構成

クリーンURL構成（各ページは `ページ名/index.html` に配置し、URL から `.html` を排除）。

| URL | 概要 |
|---|---|
| `/` | トップページ (Geometric Motion ヒーロー) |
| `/about-detail/` | 会社情報・代表メッセージ・アクセス |
| `/service-list/` | 事業一覧 |
| `/service-ses/` | SES事業 (Coverage タブ × 5) |
| `/service-quality/` | 品質保証事業 (Coverage タブ × 4) |
| `/service-dx/` | DX支援事業 (Coverage タブ × 4) |
| `/recruit/` | 採用情報 (社員の声・案件・1日の流れ等) |
| `/media/` | メディア (公式SNS: X・LinkedIn・note) |
| `/contact/` | お問い合わせフォーム (reCAPTCHA v3) |
| `/privacy-policy/` | プライバシーポリシー |
| `/security-policy/` | 情報セキュリティ基本方針 |

共通ヘッダ・フッタは `_partials/*.html` を `data-include` で動的注入。

## ディレクトリ構造

```
.
├── index.html                  ... トップページ (ルート直下はこの1枚のみ)
├── {page}/index.html           ... 各ページ (クリーンURL)
├── _partials/                  ... 共通ヘッダ/フッタ + GAS用コード
├── docs/SPEC.md                ... 開発仕様書 (詳細はこちら)
├── assets/
│   ├── css/
│   │   ├── common.css         ... 全ページ共通スタイル
│   │   ├── game.css           ... ゲーム機能専用
│   │   └── pages/             ... 各ページ専用スタイル
│   ├── js/
│   │   ├── common.js          ... 共通スクリプト
│   │   ├── include-partials.js ... 共通部品注入
│   │   ├── contact-embed.js   ... contact セクション動的注入
│   │   ├── coverage-tabs.js   ... service ページの Coverage タブ切替
│   │   ├── game.js            ... 隠し要素 (ロゴクリックで起動するゲーム)
│   │   └── pages/
│   │       ├── index.js       ... トップページ専用
│   │       └── tritech-puzzle.js ... About セクション内パズル
│   └── images/                ... ロゴ・写真・SNSアイコン
├── sitemap.xml / robots.txt    ... SEO
├── .dev-server.js              ... ローカル開発用サーバ (Node)
└── CNAME / .nojekyll           ... GitHub Pages 設定
```

## ダブルメンテ防止の仕組み

サイト全体でデータの単一管理を徹底:

| データ | 唯一の真実 | 反映先 |
|---|---|---|
| 共通ヘッダ・フッタ | `_partials/*.html` | 全ページ (`data-include`) |
| 会社概要・アクセス | `about-detail/index.html` の各セクション | `index.html` (ci-mirror: `data-source`) |
| SNSカード | `media/index.html` の `#sec-sns` | `index.html` (ci-mirror: `data-source`) |
| 社員の声 | `assets/data/voices.json` | `index.html` + `recruit/` (カード自動生成) |
| チャートデータ | `assets/data/stats.json` | `index.html` + `recruit/` |
| 案件データ (`PROJECT_DATA`) | `recruit/index.html` 内 IIFE | `recruit/` 内のターミナル/カード/モーダル/注目案件 |
| Contact セクション | `index.html` の `#contact` | `service-*/` (fetch+inject) |
| 待遇/休暇 (`#sec-benefits`) | `index.html` | `recruit/` (fetch+li抽出) |
| 数字データ (`#data`) | `index.html` | `recruit/` (fetch+チャート再描画) |
| 選ばれる理由 (`#sec-reason`) | `index.html` | `recruit/` (fetch+抽出) |

## お問い合わせフォーム

`/contact/` のフォームから送信されたデータは Google Apps Script (Web App) が受け取り、
**Microsoft Graph API** 経由で `info@tritechinc.jp` を送信元としてメール送信する
(DKIM/SPF/DMARC pass・迷惑メール対策)。同時に送信者へサンキューメールも自動送信。
reCAPTCHA v3 によるスパム判定付き。

GAS側コードは `_partials/contact-form-gas.js` を参照。

## デプロイ

`main` ブランチに push すると GitHub Pages 経由で自動的に
[tritechinc.jp](https://tritechinc.jp) に反映される。

## ローカル開発

```bash
# 同梱の開発サーバ (Node.js のみで動作・クリーンURL解決対応)
node .dev-server.js
# → http://localhost:8000 で確認

# または
python -m http.server 8000
```

`fetch()` を使う共通部品注入機能があるため、必ず HTTP サーバ経由で開くこと
(`file://` で直接開くと動作しません)。

## ドキュメント

開発仕様の詳細は [docs/SPEC.md](docs/SPEC.md) を参照。

---
&copy; 2026 株式会社トライテック. All rights reserved.
