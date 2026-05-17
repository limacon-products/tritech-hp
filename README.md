# 株式会社トライテック コーポレートサイト

[https://tritechinc.jp](https://tritechinc.jp)

## 概要

株式会社トライテックのコーポレートサイト。SES・品質保証・DX支援の3事業紹介、採用情報、お問い合わせフォームを提供。

## 技術スタック

- **HTML / CSS / Vanilla JavaScript** (フレームワーク不使用)
- **GitHub Pages** によるホスティング
- **Google Apps Script (GAS)** によるお問い合わせフォーム送信
- **DNS**: お名前.com (`tritechinc.jp`)
- **メール**: Microsoft 365 + Google Workspace SPF (`info@tritechinc.jp`)

## ページ構成

| ファイル | 概要 |
|---|---|
| `index.html` | トップページ (Geometric Motion ヒーロー) |
| `about-detail.html` | 会社情報・代表メッセージ・アクセス |
| `service-list.html` | 事業一覧 |
| `service-ses.html` | SES事業 (Coverage タブ × 5) |
| `service-quality.html` | 品質保証事業 (Coverage タブ × 4) |
| `service-dx.html` | DX支援事業 (Coverage タブ × 4) |
| `recruit.html` | 採用情報 (社員の声・案件・1日の流れ等) |
| `contact.html` | お問い合わせフォーム |
| `privacy-policy.html` | プライバシーポリシー |
| `_partials/header.html` | 共通ヘッダー (data-include で動的注入) |
| `_partials/footer.html` | 共通フッター (data-include で動的注入) |

## ディレクトリ構造

```
.
├── *.html                      ... 各ページ
├── _partials/                  ... 共通ヘッダ/フッタ
├── assets/
│   ├── css/
│   │   ├── common.css         ... 全ページ共通スタイル
│   │   └── pages/             ... 各ページ専用スタイル
│   ├── js/
│   │   ├── common.js          ... 共通スクリプト
│   │   ├── include-partials.js ... 共通部品注入
│   │   ├── contact-embed.js   ... contact セクション動的注入
│   │   ├── coverage-tabs.js   ... service ページの Coverage タブ切替
│   │   ├── game.js            ... 隠し要素 (ロゴクリックで起動するゲーム)
│   │   └── pages/index.js     ... トップページ専用
│   └── images/                ... ロゴ・写真等
└── CNAME                      ... GitHub Pages カスタムドメイン設定
```

## ダブルメンテ防止の仕組み

サイト全体でデータの単一管理を徹底:

| データ | 唯一の真実 | 反映先 |
|---|---|---|
| 共通ヘッダ・フッタ | `_partials/*.html` | 全ページ |
| 会社概要・アクセス | `about-detail.html` の各セクション | `index.html` (fetch+inject) |
| 社員の声 (`VOICE_DATA`) | `assets/js/pages/index.js` | `recruit.html` (fetch+eval) |
| 案件データ (`PROJECT_DATA`) | `recruit.html` 内 IIFE | `recruit.html` 内のターミナル/カード/モーダル |
| Contact セクション | `index.html` の `#contact` | `service-*.html` (fetch+inject) |
| 待遇/休暇 (`#sec-benefits`) | `index.html` | `recruit.html` (fetch+li抽出) |
| 数字データ (`#data`) | `index.html` | `recruit.html` (fetch+チャート再描画) |

## お問い合わせフォーム (GAS)

`contact.html` のフォームから送信されたデータは Google Apps Script (Web App) 経由で
`info@tritechinc.jp` へ届く。同時に送信者へサンキューメールも自動送信。

セットアップ詳細は `_partials/contact-form-gas.js` のコメントを参照。

## デプロイ

`main` ブランチに push すると GitHub Pages 経由で自動的に
[tritechinc.jp](https://tritechinc.jp) に反映される。

## ローカル開発

```bash
# 任意の静的サーバで HTTP 配信
python -m http.server 8000
# → http://localhost:8000 で確認
```

`fetch()` を使う共通部品注入機能があるため、必ず HTTP サーバ経由で開くこと
(`file://` で直接開くと動作しません)。

---
&copy; 2026 株式会社トライテック. All rights reserved.
