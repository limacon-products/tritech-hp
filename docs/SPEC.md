# 株式会社トライテック コーポレートサイト 開発仕様書

|  項目  |  内容  |
| --- | --- |
| バージョン | 1.1.0 |
| 最終更新 | 2026-07-11 |
| 本番URL | https://tritechinc.jp |
| リポジトリ | https://github.com/limacon-products/tritech-hp (Public) |
| ライセンス | 株式会社トライテック 所有 (All Rights Reserved、`LICENSE` 参照) |

---

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [技術スタック](#2-技術スタック)
3. [ディレクトリ構造](#3-ディレクトリ構造)
4. [ページ仕様](#4-ページ仕様)
5. [共通コンポーネント](#5-共通コンポーネント)
6. [デザインシステム](#6-デザインシステム)
7. [JavaScript アーキテクチャ](#7-javascript-アーキテクチャ)
8. [ダブルメンテ防止設計](#8-ダブルメンテ防止設計)
9. [お問い合わせフォーム仕様](#9-お問い合わせフォーム仕様)
10. [ホスティング・DNS・計測](#10-ホスティングdns計測)
11. [ローカル開発](#11-ローカル開発)
12. [デプロイフロー](#12-デプロイフロー)
13. [保守メモ](#13-保守メモ)

---

## 1. プロジェクト概要

### 1.1 目的

株式会社トライテックのコーポレートサイト。以下を主目的とする。

- 採用力強化（エンジニア向け情報訴求）
- 3事業（SES・品質保証・DX支援）の明確化
- お問い合わせ獲得（リードジェネレーション）
- ブランディング統一
- 公式SNS（X・LinkedIn・note）への導線集約

### 1.2 ターゲット

- **エンジニア候補者**（IT技術者・転職検討中）
- **取引先企業**（SES契約・QA委託・DX相談）
- **メディア・採用エージェント**

### 1.3 サイト要件

| 項目 | 要件 |
|---|---|
| パフォーマンス | Lighthouse Performance 80以上目標 |
| 対応ブラウザ | Chrome / Safari / Edge / Firefox 最新2バージョン |
| レスポンシブ | 960px以下でモバイル最適化、600px以下で完全モバイル |
| アクセシビリティ | WCAG 2.1 AA 準拠を目指す |
| SEO | クリーンURL / canonical / meta description / OGP / Twitter Card / sitemap.xml / robots.txt 対応済み |

---

## 2. 技術スタック

### 2.1 採用技術

| カテゴリ | 技術 | 採用理由 |
|---|---|---|
| マークアップ | HTML5 | 標準・軽量 |
| スタイル | CSS3 (Vanilla) | フレームワーク不使用、保守性重視 |
| スクリプト | Vanilla JavaScript (ES2020+) | 依存ゼロ、長期保守 |
| ホスティング | GitHub Pages | 無料・自動デプロイ・SSL自動 |
| メール送信 | Google Apps Script + **Microsoft Graph API** | `info@tritechinc.jp` を真の送信元にし DMARC pass（迷惑メール回避） |
| スパム対策 | Google reCAPTCHA v3 | フォーム悪用対策（スコア判定） |
| アクセス解析 | Google Analytics 4 (gtag.js) | 測定ID `G-WQRCJC9H8X`・全ページ設置 |
| バージョン管理 | Git + GitHub | 業界標準 |
| DNS | お名前.com | 既存運用継続 |

### 2.2 採用しなかった技術と理由

| 技術 | 不採用理由 |
|---|---|
| React/Vue/Next.js | 動的機能が限定的、ビルド工程の保守負荷大 |
| WordPress | サーバー必要・脆弱性対応負荷・コスト |
| Webpack/Vite | 必要性なし、シンプルな静的サイトで十分 |
| TypeScript | チーム規模に対し過剰、Vanilla JSで型ない問題は最小 |

### 2.3 外部依存

- **Google Fonts**: Syne / Noto Sans JP / JetBrains Mono
- **Google Apps Script**: お問い合わせフォーム送信エンドポイント（内部で Microsoft Graph API を呼び出し）
- **Google reCAPTCHA v3**: `contact/` ページで読み込み
- **Google Analytics 4 (gtag.js)**: 全公開ページで読み込み

---

## 3. ディレクトリ構造

**クリーンURL構成**: ルート直下の HTML は `index.html`（トップ）のみ。他ページはすべて
`ページ名/index.html` の形で配置し、URL から `.html` を排除している
（例: `https://tritechinc.jp/about-detail/`）。

```
tritech-hp/
├── index.html                  # トップページ (ルート直下はこの1枚のみ)
├── about-detail/index.html     # 会社情報
├── service-list/index.html     # 事業一覧
├── service-ses/index.html      # SES事業
├── service-quality/index.html  # 品質保証事業
├── service-dx/index.html       # DX支援事業
├── recruit/index.html          # 採用情報 (暗テーマ・約2800行)
├── media/index.html            # メディア (公式SNS一覧)
├── contact/index.html          # お問い合わせフォーム
├── privacy-policy/index.html   # プライバシーポリシー
├── security-policy/index.html  # 情報セキュリティ基本方針
│
├── CNAME                       # GitHub Pages カスタムドメイン (tritechinc.jp)
├── .nojekyll                   # Jekyll 無効化 (_partials/ 配信のため)
├── robots.txt                  # /_partials/ を Disallow、sitemap 参照
├── sitemap.xml                 # 全11 URL を登録
├── .dev-server.js              # ローカル開発用 静的サーバ (Node.js・依存なし)
├── wrangler.jsonc              # Cloudflare wrangler 設定 (ローカル検証用。本番ホスティングには未使用)
├── README.md                   # リポジトリ概要
├── LICENSE                     # All Rights Reserved
├── .gitignore
│
├── _partials/                  # 共通HTML部品
│   ├── header.html             # 共通ヘッダ
│   ├── footer.html             # 共通フッタ
│   └── contact-form-gas.js     # GAS側コード (Graph API版・デプロイ用)
│
├── docs/
│   └── SPEC.md                 # 本仕様書
│
├── dummy-hero/                 # ヒーロー案デモ3種 (作業用・サイト内リンクなし)
├── archive/                    # 旧版HTML (作業用・サイト内リンクなし)
│
└── assets/
    ├── css/
    │   ├── common.css          # 全ページ共通スタイル
    │   ├── game.css            # ゲーム機能専用
    │   └── pages/
    │       ├── index.css        # トップページ専用 (service系ページも読込)
    │       ├── index-recruit.css # トップ内 採用セクション専用
    │       ├── media.css        # メディアページ専用
    │       ├── service-page.css # service-* 共通
    │       ├── service-list.css # 事業一覧専用
    │       └── service-ses.css  # SES専用
    ├── js/
    │   ├── common.js           # 共通スクリプト (cursor, nav, hamburger)
    │   ├── include-partials.js # 共通部品注入エンジン
    │   ├── contact-embed.js    # contactセクション動的注入
    │   ├── coverage-tabs.js    # service ページ Coverage タブ切替
    │   ├── game.js             # 隠しシューティングゲーム (約2750行)
    │   └── pages/
    │       ├── index.js        # トップページ専用
    │       └── tritech-puzzle.js # トップ About セクション内ブロックパズル
    └── images/
        ├── logo/               # ロゴ各種 (png/svg)
        ├── photos/             # 写真素材
        └── sns/                # SNSアイコン (x/linkedin/note)
```

※ 社内ドキュメント (`*_セットアップ手順.txt`、`リリース手順.txt`、`プロジェクト経緯まとめ.txt`、
姉妹サイト構築引継ぎ資料、案件抽出CSV) はローカル作業フォルダにのみ置き、公開リポジトリの
管理対象と区別する（詳細は [13.4 関連ドキュメント](#134-関連ドキュメント)）。

---

## 4. ページ仕様

### 4.1 全ページ一覧

| URL | ファイル | タイトル | 用途 |
|---|---|---|---|
| `/` | `index.html` | ホーム | 会社全体の入り口 |
| `/about-detail/` | `about-detail/index.html` | 会社情報 | 会社概要・代表メッセージ・アクセス |
| `/service-list/` | `service-list/index.html` | 事業内容 | 3事業の一覧 |
| `/service-ses/` | `service-ses/index.html` | SES事業 | SES詳細 + 実績数字 |
| `/service-quality/` | `service-quality/index.html` | 品質保証事業 | QA詳細 |
| `/service-dx/` | `service-dx/index.html` | DX支援事業 | DX詳細 |
| `/recruit/` | `recruit/index.html` | 採用情報 | エンジニア向け採用ページ |
| `/media/` | `media/index.html` | メディア | 公式SNS (X×2・LinkedIn・note) の紹介 |
| `/contact/` | `contact/index.html` | お問い合わせ | 入力フォーム (reCAPTCHA v3) |
| `/privacy-policy/` | `privacy-policy/index.html` | プライバシーポリシー | 個人情報保護方針 |
| `/security-policy/` | `security-policy/index.html` | 情報セキュリティ基本方針 | セキュリティへの取り組み |

全ページ共通で canonical / OGP / Twitter Card / GA4 タグを `<head>` に設置。

### 4.2 各ページの主要セクション

#### `index.html`
- Hero (Geometric Motion 背景アニメ)
- About (会社紹介の入口・ブロックパズル `tritech-puzzle.js` 内蔵)
- Service (3事業の入口)
- Data (数字で見るトライテック + 棒グラフ + ドーナツチャート)
- **ci-mirror セクション×3**: `data-source` 属性で他ページから fetch+inject
  - `#overview-mirror` ← `/about-detail/#sec-overview` (会社概要)
  - `#access-mirror` ← `/about-detail/#sec-access` (アクセス)
  - `#sns-mirror` ← `/media/#sec-sns` (SNSカード)
- Transition Zone (`#transition-zone`・エンジニア向け導入)
- Recruit Section (`#sec-slogan` `#sec-reason` `#sec-reward` `#sec-choice` `#sec-team` `#sec-benefits` `#sec-voices`)
- Contact (`#contact`・service ページへの注入元)

#### `recruit/index.html` (独自テーマの黒背景デザイン)
- Hero (タイピングコード・カスタムカーソル)
- 株式会社トライテックが選ばれる理由 (index.html `#sec-reason` から fetch・recruitデザインで再描画)
- 数字で見るトライテック (index.html `#data` から fetch・チャート再描画)
- 案件イメージ (9案件カルーセル・クリックでモーダル・`PROJECT_DATA` 一元管理)
- 注目の案件 (ターミナル演出・`PROJECT_DATA` からランダム最大3件)
- 社員の声 (カルーセル・`assets/data/voices.json` から動的取得)
- エンジニアの1日の流れ (5タブ切替)
- 募集要項
- 待遇/休暇 (index.html `#sec-benefits` から fetch)
- 入社までの流れ
- Contact

#### `service-{ses,quality,dx}/index.html`
- Hero (h1 メッセージ・改行調整済み)
- Overview
- Strengths (3つの強み)
- Coverage (タブ切替: 画像+詳細説明)
- Stats (SES のみ・上段2列下段4列)
- Service Flow (SES のみ)
- Support
- Contact (`data-embed="contact"` で index.html から注入)

#### `media/index.html`
- Hero
- SNS CARDS (`#sec-sns`): X 営業 / X 人事 / LinkedIn / note の4カード
  - **自己完結インラインスタイル**: `#sec-sns` にスコープを限定した `<style>` をセクション内に持ち、
    index.html へ fetch+inject された際もデザインが追従する設計

#### `security-policy/index.html`
- privacy-policy と同構造のポリシー文書ページ（ページ内 `<style>` 完結）

---

## 5. 共通コンポーネント

### 5.1 共通ヘッダ (`_partials/header.html`)

全ページに `<div data-include="header"></div>` を配置すると注入される。

> **意図的な例外: `recruit/`** — 採用特設LPとして独自ナビ (選ばれる理由/データ/
> 案件イメージ/社員の声/募集要項 のページ内アンカー + エントリーCTA) を
> インラインで持つ。候補者をページ内で完結させる設計であり、共通ヘッダへの
> 統一は行わない (2026-07 確認済みの設計判断)。
リンクはすべて **ルート絶対パス**（`/about-detail/` 等）で記述し、どの階層のページからも解決できる。

#### メニュー構成
1. ホーム → `/`
2. エンジニアの方へ → `/#transition-zone`
3. 会社情報 → `/about-detail/`
4. 事業内容 → `/service-list/`
5. メディア → `/media/`
6. お問い合わせ → `/contact/`
7. **採用情報** (CTAボタン) → `/recruit/`

#### 追加機能
- カスタムカーソル (3つの菱形 オレンジ→水色→紺 が遅延付きで追従)
- ロゴ画像 (クリックでゲーム起動)
- モバイル時はハンバーガーメニューに切替

### 5.2 共通フッタ (`_partials/footer.html`)

全ページに `<div data-include="footer"></div>` を配置すると注入される。

#### 構成
- 左カラム: ロゴ + 説明 + RECRUITボタン + **SNSリンク (FOLLOW US)**
  - X 営業アカウント (`@tritech_ses`)
  - X 人事アカウント (`@toku_tritech`)
  - LinkedIn (`tritech-jinji`)
  - note (`tokunaga_tritech`)
- 右カラム: 8リンク
  - ホーム / エンジニアの方へ / 会社情報 / 事業内容 / メディア / お問い合わせ / プライバシーポリシー / 情報セキュリティ基本方針
- 下部: コピーライト「© 2026 株式会社トライテック」

### 5.3 注入エンジン (`assets/js/include-partials.js`)

```js
// data-include 属性を持つ要素を探し、/_partials/{name}.html を fetch
// 取得したHTMLで slot を置き換え
// 完了後 partials:loaded イベントを発火
```

依存スクリプトは `partials:loaded` イベントで動作開始することで、
注入完了後に DOM操作を行う。

### 5.4 ci-mirror (セクションミラー機構)

`index.html` 側に `data-source="/about-detail/#sec-overview"` のような属性を持つ
空セクションを置くと、`pages/index.js` の `mirrorCompanyInfoSections()` が
参照先ページを fetch して該当セクションを丸ごと注入する。
「唯一の真実」を持つページを1箇所編集すれば index.html にも自動反映される
（[8. ダブルメンテ防止設計](#8-ダブルメンテ防止設計) 参照）。

ミラー注入後にハッシュ位置がずれるため、`rescrollToHash()` で
アンカースクロールを復元する。

---

## 6. デザインシステム

### 6.1 カラーパレット

```css
/* index系 (明るいテーマ) */
--orange:       #D95F1E   /* メインアクセント (オレンジ) */
--orange-light: rgba(217,95,30,.1)
--teal:         #1E8FA0   /* サブアクセント (ティール) */
--teal-light:   rgba(30,143,160,.1)
--navy:         #1A3A6A   /* 補助 (ダークネイビー) */
--navy-light:   rgba(26,58,106,.1)
--ink:          #0F1224   /* 主要テキスト */
--ink2:         #2B2F45   /* 副テキスト */
--muted:        #6B7280   /* 補足テキスト */
--white:        #FFFFFF
--bg:           #FBF9F4   /* 全体背景 */
--surface:      #FFFFFF   /* カード背景 */
--border:       rgba(15,18,36,.1)

/* recruit/ (暗テーマ) */
--bg:           #0B0E1A
--bg2:          #06080F
--surface:      #14182A
--text:         #F0F0FF
--text2:        rgba(240,240,255,.6)
--text3:        rgba(240,240,255,.3)
--cyan:         #00F5C8
--blue:         #4D6FFF
--purple:       #9B59FF
--orange:       #FF8856
--pink:         #FF5588
--border:       rgba(255,255,255,.08)
--border2:      rgba(255,255,255,.15)
```

### 6.2 タイポグラフィ

```css
/* 見出し: ロゴ系 */
font-family: 'Syne', sans-serif;  /* h1, h2 ヒーロー文字 */

/* 本文: 日本語 */
font-family: 'Noto Sans JP', sans-serif;

/* コード・ターミナル風 */
font-family: 'JetBrains Mono', monospace;
```

### 6.3 ロゴモチーフ

トライテックロゴは「菱形3つ」の繰り返し。サイト全体でこのモチーフを統一：

- カスタムカーソル: 3つの菱形が追従
- ヒーロー背景: 浮遊する菱形 + 流れる小菱形
- リスト記号: ▸ (オレンジ三角)

### 6.4 アニメーション

- `.reveal` クラスでスクロール時にフェードイン
- IntersectionObserver で 12% 表示で `in` クラス付与
- 各カードは `transition-delay` で時間差発火

---

## 7. JavaScript アーキテクチャ

### 7.1 スクリプトの読み込み

すべて **ルート絶対パス** (`/assets/js/...`) で参照する
（クリーンURL構成のため、相対パスだとサブディレクトリページで解決できない）。

```html
<script src="/assets/js/include-partials.js"></script>          <!-- 全ページ -->
<script src="/assets/js/common.js" defer></script>               <!-- 全ページ -->
<script src="/assets/js/contact-embed.js" defer></script>        <!-- service-* のみ -->
<script src="/assets/js/coverage-tabs.js" defer></script>        <!-- service-{ses,quality,dx} のみ -->
<script src="/assets/js/pages/index.js" defer></script>          <!-- index.html のみ -->
<script src="/assets/js/pages/tritech-puzzle.js" defer></script> <!-- index.html のみ -->
<script src="/assets/js/game.js" defer></script>                 <!-- 全ページ (隠しゲーム) -->
```

### 7.2 各スクリプトの役割

| ファイル | 主な機能 |
|---|---|
| `include-partials.js` | `data-include="..."` 要素を `_partials/*.html` で置換 |
| `common.js` | カスタムカーソル / ハンバーガーメニュー / スクロールプログレス |
| `contact-embed.js` | `data-embed="contact"` を `/` (index.html) の `#contact` で置換 |
| `coverage-tabs.js` | service ページの Coverage タブをホバー/タップで切替 |
| `pages/index.js` | ci-mirror 注入 / データチャート / カウントアップ / 社員の声カード生成 (voices.json) |
| `pages/tritech-puzzle.js` | About セクション内ブロックパズル |
| `game.js` | 隠しシューティングゲーム本体 (約2750行・5ステージ) |

### 7.3 IIFE パターン

各スクリプトは `(function(){ ... })()` の即時実行関数でスコープを分離し、
グローバル汚染を最小化。

```js
(function(){
  'use strict';
  // 処理
})();
```

---

## 8. ダブルメンテ防止設計

複数ページで同じ情報を表示する場合、「**唯一の真実**」を1箇所に定め、
他は JS fetch で動的取得する。

### 8.1 一覧

| データ | 唯一の真実 | 反映先 | 仕組み |
|---|---|---|---|
| ヘッダ・フッタ | `_partials/*.html` | 全ページ | `data-include` |
| 会社概要・アクセス | `about-detail/index.html` の `#sec-overview` `#sec-access` | `index.html` | ci-mirror (`data-source`) |
| SNSカード | `media/index.html` の `#sec-sns` | `index.html` | ci-mirror (`data-source`)・スタイルはセクション内に自己完結 |
| 社員の声 | **`assets/data/voices.json`** | `index.html` + `recruit/` (カード・モーダルとも自動生成) | fetch + JSON (編集ガイド: `assets/data/README.md`) |
| チャートデータ (棒/ドーナツ/凡例) | **`assets/data/stats.json`** | `index.html` + `recruit/` | fetch + JSON |
| 案件データ (PROJECT_DATA) | `recruit/index.html` 内 IIFE (`window.PROJECT_DATA` 公開) | recruit内4箇所 (カード/モーダル/ターミナル/注目案件3件) | window参照 |
| Contact セクション | `index.html` の `#contact` | service-{list,ses,quality,dx}/ | fetch('/') + DOM抽出 (`data-embed="contact"`) |
| 待遇・休暇 (li) | `index.html` の `#sec-benefits` | `recruit/` | fetch('/') + li抽出 |
| 数字データ (.dc) | `index.html` の `#data` | `recruit/` | fetch('/') + チャート再描画 |
| 選ばれる理由 (.reason-card) | `index.html` の `#sec-reason` | `recruit/` | fetch('/') + title/body抽出 |

### 8.2 設計判断の理由

- **DRY (Don't Repeat Yourself)** 原則の徹底
- 仕様変更時のメンテ工数を最小化
- 整合性の自動担保（手動コピーミスを防止）

---

## 9. お問い合わせフォーム仕様

### 9.1 構成 (Microsoft Graph API 版・2026-05 移行済み)

```
[ユーザー: /contact/]
    ↓ reCAPTCHA v3 トークン取得 → POST (JSON, text/plain)
[Google Apps Script Web App (doPost)]
    ↓ reCAPTCHA スコア検証 (RECAPTCHA_MIN_SCORE)
    ↓ Microsoft Graph API (OAuth2 Client Credentials)
[Exchange Online — info@tritechinc.jp として送信]
    ↓ DKIM / SPF / DMARC すべて pass
[① info@tritechinc.jp (Microsoft 365) ... 社内通知]
[② ユーザーのメールアドレス ... サンキューメール (自動返信)]
```

**移行の経緯**: 旧構成 (GAS `MailApp.sendEmail`) は Google のバウンスドメインから
送信されるため DMARC fail となり迷惑メール判定される問題があった。
Microsoft 365 の Graph API 経由で `info@tritechinc.jp` を真の送信元とすることで解消
（詳細は社内資料 `Microsoft_Graph_API_セットアップ手順.txt`）。

### 9.2 入力項目

| 項目 | 必須 | 種別 |
|---|---|---|
| お問い合わせ種別 | ✅ | select (サービス・採用・パートナー・取材・その他) |
| お名前 | ✅ | text |
| 会社名 | - | text |
| メールアドレス | ✅ | email |
| 電話番号 | - | tel |
| お問い合わせ内容 | ✅ | textarea |
| プライバシーポリシー同意 | ✅ | checkbox |

### 9.3 GAS エンドポイント・認証情報

- GAS側コード: `_partials/contact-form-gas.js`（Graph API 版）
- ⚠️ エンドポイントURLは本仕様書には記載せず、`contact/index.html` 内の `GAS_ENDPOINT` 定数で管理
- GAS スクリプトプロパティで管理する秘密情報:
  - `TENANT_ID` / `CLIENT_ID` / `CLIENT_SECRET` (Microsoft Entra ID アプリ登録)
  - `RECAPTCHA_SECRET` (reCAPTCHA v3 シークレットキー)
- ⚠️ **クライアントシークレットは24か月で期限切れ → 2028年4月頃に更新が必要**

### 9.4 セキュリティ・スパム対策

- HTML5 標準バリデーション + JS による必須チェック
- **Google reCAPTCHA v3**: フロントでトークン取得 → GAS側でスコア検証
  （`ENABLE_RECAPTCHA` / `RECAPTCHA_MIN_SCORE` で調整可）
- メッセージにURL 3つ以上で送信拒否
- プライバシーポリシー同意必須
- HTTPS でのみ送信（GitHub Pages SSL）

---

## 10. ホスティング・DNS・計測

### 10.1 GitHub Pages

| 項目 | 内容 |
|---|---|
| リポジトリ | `limacon-products/tritech-hp` (Public) |
| ブランチ | `main` |
| ビルド | なし（静的HTMLそのまま配信） |
| デプロイ | `git push` で自動 |
| SSL | Let's Encrypt 自動発行・HTTPS強制ON |
| カスタムドメイン | `tritechinc.jp` (CNAMEファイル配置済み) |
| Jekyll | 無効化 (`.nojekyll` ファイル配置済み) |

`.nojekyll` ファイルを配置することで GitHub Pages が Jekyll 処理を
バイパスし、`_partials/` 等のアンダースコア始まりのディレクトリも
そのまま配信される。

※ `wrangler.jsonc` はローカル検証 (Cloudflare wrangler) 用の設定で、
本番ホスティングには使用していない。

### 10.2 DNS設定 (お名前.com)

DNS管理はお名前.com で継続。Cloudflare 等への移管は実施していない。

```
# A レコード (GitHub Pages のIP - 4つ全て登録)
@  A  185.199.108.153
@  A  185.199.109.153
@  A  185.199.110.153
@  A  185.199.111.153

# CNAME (www サブドメイン)
www  CNAME  limacon-products.github.io.

# autodiscover (Outlook 自動構成)
autodiscover  CNAME  autodiscover.outlook.com

# MX (メール受信 - Microsoft 365)
@  MX  0  tritechinc-jp.mail.protection.outlook.com

# Microsoft 365 ドメイン認証
@  TXT  MS=ms36229899

# SPF (メール送信元認証)
@  TXT  v=spf1 include:spf.protection.outlook.com include:_spf.google.com ~all

# DMARC (なりすまし対策)
_dmarc  TXT  v=DMARC1; p=none; rua=mailto:info@tritechinc.jp; ruf=mailto:info@tritechinc.jp; fo=1
```

### 10.3 SEO・計測

| 項目 | 内容 |
|---|---|
| Google Analytics 4 | 測定ID `G-WQRCJC9H8X`・全公開ページの `<head>` に gtag.js 設置 |
| sitemap.xml | 全11 URL（クリーンURL形式）を登録・`robots.txt` から参照 |
| robots.txt | 全許可 + `/_partials/` のみ Disallow |
| canonical | 各ページに `https://tritechinc.jp/{page}/` 形式で設置 |
| OGP / Twitter Card | 全ページ設置（og:image はロゴPNG） |

---

## 11. ローカル開発

### 11.1 環境構築

特別なツール不要。HTTPサーバが起動できればOK。

```bash
# 同梱の開発サーバ (推奨・Node.js のみで動作、キャッシュ無効化済み)
node .dev-server.js        # → http://localhost:8000/
node .dev-server.js 3000   # ポート指定

# または Python 3
python -m http.server 8000
```

`.dev-server.js` はディレクトリアクセス時に `index.html` を自動解決するため、
本番 (GitHub Pages) と同じクリーンURL（`/about-detail/` 等）で確認できる。

⚠️ `fetch()` を使う共通部品注入機能があるため、必ず HTTP サーバ経由で開くこと。
`file://` プロトコルでは CORS エラーで共通部品が表示されません。

### 11.2 開発フロー

```bash
# 1. リポジトリをクローン
git clone https://github.com/limacon-products/tritech-hp.git
cd tritech-hp

# 2. 編集

# 3. ローカル確認
node .dev-server.js

# 4. コミット & push
git add .
git commit -m "更新内容"
git push origin main

# 5. 数十秒で https://tritechinc.jp/ に反映
```

### 11.3 ブランチ運用 (任意)

本番への直push を避けたい場合：

```bash
git checkout -b feature/xxx
# 編集
git push origin feature/xxx
# GitHubでPull Request → レビュー → main にマージ
```

---

## 12. デプロイフロー

### 12.1 自動デプロイ

`main` ブランチへの push を契機に、GitHub Pages が自動的にビルド・デプロイ。

```
[git push origin main]
    ↓
[GitHub Pages ビルド (約30秒〜数分)]
    ↓
[https://tritechinc.jp/ に反映]
```

### 12.2 ロールバック

問題が発生した場合：

```bash
# 直前のコミットに戻す
git revert HEAD
git push origin main

# または特定のコミットに完全に戻す
git reset --hard <commit-hash>
git push -f origin main
```

---

## 13. 保守メモ

### 13.1 よくある編集タスク

| タスク | 編集箇所 |
|---|---|
| ヘッダメニュー追加 | `_partials/header.html` (PCとモバイル両方) |
| フッタリンク・SNSリンク変更 | `_partials/footer.html` |
| SNSカード（メディアページ）変更 | `media/index.html` の `#sec-sns` (index.htmlにも自動反映) |
| 会社情報変更 | `about-detail/index.html` (index.htmlにも自動反映) |
| 社員の声の追加・入れ替え | `assets/data/voices.json` のみ (手順: `assets/data/README.md`) |
| チャートの数字更新 | `assets/data/stats.json` のみ |
| 案件追加・更新 | `recruit/index.html` 内の `PROJECT_DATA` |
| メインカラー変更 | `assets/css/common.css` の CSS変数 |
| お問い合わせフォーム項目追加 | `contact/index.html` の form と `_partials/contact-form-gas.js` の両方 |
| ページ追加 | `{page}/index.html` 作成 + `sitemap.xml` にURL追加 + 必要ならヘッダ/フッタにリンク |

### 13.2 トラブル対応

| 症状 | 確認箇所 |
|---|---|
| 画像が表示されない | パスの大文字小文字 (GitHub Pagesは区別する)・ルート絶対パスか |
| お問い合わせ送信失敗 | GAS の「アクセスできるユーザー」が「全員」か / Graph API のシークレット期限 (2028年4月頃) |
| 送信メールが迷惑メール扱い | GAS が Graph API 版コードか (`_partials/contact-form-gas.js`)・DMARC レポート確認 |
| reCAPTCHA ではじかれる | GAS の `RECAPTCHA_MIN_SCORE` を下げる / `ENABLE_RECAPTCHA` 確認 |
| サンキューメールが届かない | `ENABLE_THANKYOU = true` か |
| ヘッダが表示されない | HTTP経由でアクセスしているか (file://は NG) |
| 社員の声が出ない | `assets/data/voices.json` の JSON 構文確認 (jsonlint 等) |
| index.html の会社概要/SNSが出ない | 参照先ページの `data-source` 対象セクション ID が変わっていないか |

### 13.3 既知の制約・問題

- **JavaScript必須**: 共通部品注入に依存。JSオフのブラウザでは正常表示できない（許容）
- **IE11非対応**: ES2020+ 機能を多用。サポートしない
- **静的サイト**: 動的データ取得には別途バックエンド（GAS等）が必要
- **GitHub Pages帯域制限**: 月100GB（通常範囲では問題なし）
- **旧URL (`/xxx.html`) は 404**: クリーンURL化に伴いルート直下の各 `*.html` は撤去済み。
  旧URLへの被リンクがある場合はリダイレクト手段がない点に注意

### 13.4 関連ドキュメント

| ファイル | 公開/社内 | 内容 |
|---|---|---|
| `README.md` | 公開 | リポジトリトップ |
| `docs/SPEC.md` | 公開 | 本仕様書 |
| `_partials/contact-form-gas.js` | 公開 | GASに貼るコード本体 (Graph API版) |
| `Microsoft_Graph_API_セットアップ手順.txt` | 社内のみ | Graph API 移行・設定手順（**現行**） |
| `GAS_セットアップ手順.txt` | 社内のみ | 旧 MailApp 版の設定手順（参考・移行済み） |
| `リリース手順.txt` | 社内のみ | STUDIO → GitHub Pages 切替手順 |
| `プロジェクト経緯まとめ.txt` | 社内のみ | 開発経緯・判断記録 |
| `姉妹サイト構築_引継ぎメモ.txt` / `姉妹サイト構築_引継ぎプロンプト.txt` | 社内のみ | 姉妹サイト展開用の引継ぎ資料 |

---

## 改訂履歴

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-05-17 | 1.0.0 | 初版 |
| 2026-05-18 | 1.0.1 | 軽微修正 |
| 2026-07-11 | 1.1.0 | 現状反映: クリーンURL化 (`{page}/index.html` 構成) / `media`・`security-policy` ページ追加 / ヘッダ・フッタのメニュー更新 (メディア・SNSリンク・セキュリティ方針) / ci-mirror 機構 / お問い合わせを Microsoft Graph API 経由に移行 + reCAPTCHA v3 導入 / GA4・sitemap.xml・robots.txt 設置 / `.dev-server.js` 追加 / README.md も同時更新 / privacy-policy のゲームブロック重複を修正 |

---

## 連絡先

- **サイト管理**: 株式会社トライテック (info@tritechinc.jp)
- **開発**: 株式会社Limaçon 清水 幸秀 (shimizu@limacon.co.jp)

---

&copy; 2026 株式会社トライテック. All rights reserved.
