# 株式会社トライテック コーポレートサイト 開発仕様書

|  項目  |  内容  |
| --- | --- |
| バージョン | 1.0.0 |
| 最終更新 | 2026-05-17 |
| 本番URL | https://tritechinc.jp |
| リポジトリ | https://github.com/limacon-products/tritech-hp |
| ライセンス | 株式会社トライテック 所有 (Internal) |

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
10. [ホスティング・DNS](#10-ホスティングdns)
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
| SEO | meta description / OGP / 構造化データ対応推奨 |

---

## 2. 技術スタック

### 2.1 採用技術

| カテゴリ | 技術 | 採用理由 |
|---|---|---|
| マークアップ | HTML5 | 標準・軽量 |
| スタイル | CSS3 (Vanilla) | フレームワーク不使用、保守性重視 |
| スクリプト | Vanilla JavaScript (ES2020+) | 依存ゼロ、長期保守 |
| ホスティング | GitHub Pages | 無料・自動デプロイ・SSL自動 |
| メール送信 | Google Apps Script | サーバーレス・無料・Gmail/SPF連携 |
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
- **Google Apps Script**: お問い合わせフォーム送信エンドポイント

---

## 3. ディレクトリ構造

```
tritech-hp/
├── *.html                      # 各公開ページ (9ファイル)
├── CNAME                       # GitHub Pages カスタムドメイン
├── README.md                   # リポジトリ概要
├── .gitignore                  # Git除外設定
│
├── _partials/                  # 共通HTML部品
│   ├── header.html             # 共通ヘッダ
│   ├── footer.html             # 共通フッタ
│   └── contact-form-gas.js     # GAS側コード (デプロイ用)
│
├── docs/                       # ドキュメント
│   └── SPEC.md                 # 本仕様書
│
└── assets/
    ├── css/
    │   ├── common.css          # 全ページ共通スタイル
    │   ├── game.css            # ゲーム機能専用
    │   └── pages/
    │       ├── index.css       # トップページ専用
    │       ├── index-recruit.css # 採用セクション専用
    │       ├── service-page.css # service-* 共通
    │       ├── service-list.css # 事業一覧専用
    │       ├── service-ses.css  # SES専用
    │       └── service-detail.css # service-detail 専用
    ├── js/
    │   ├── common.js           # 共通スクリプト (cursor, nav, hamburger)
    │   ├── include-partials.js # 共通部品注入エンジン
    │   ├── contact-embed.js    # contactセクション動的注入
    │   ├── coverage-tabs.js    # service ページ Coverage タブ切替
    │   ├── game.js             # ゲーム本体 (約2500行)
    │   └── pages/
    │       ├── index.js        # トップページ専用
    │       ├── service-detail.js # service-detail専用
    │       └── tritech-puzzle.js # パズルゲーム
    └── images/
        ├── logo/               # ロゴ各種
        └── photos/             # 写真素材
```

---

## 4. ページ仕様

### 4.1 全ページ一覧

| URL | ファイル | タイトル | 用途 |
|---|---|---|---|
| `/` | `index.html` | ホーム | 会社全体の入り口 |
| `/about-detail.html` | `about-detail.html` | 会社情報 | 会社概要・代表メッセージ・アクセス |
| `/service-list.html` | `service-list.html` | 事業内容 | 3事業の一覧 |
| `/service-ses.html` | `service-ses.html` | SES事業 | SES詳細 + 実績数字 |
| `/service-quality.html` | `service-quality.html` | 品質保証事業 | QA詳細 |
| `/service-dx.html` | `service-dx.html` | DX支援事業 | DX詳細 |
| `/recruit.html` | `recruit.html` | 採用情報 | エンジニア向け採用ページ |
| `/contact.html` | `contact.html` | お問い合わせ | 入力フォーム |
| `/privacy-policy.html` | `privacy-policy.html` | プライバシーポリシー | 個人情報保護方針 |

### 4.2 各ページの主要セクション

#### `index.html`
- Hero (Geometric Motion 背景アニメ)
- About (会社紹介の入口)
- Service (3事業の入口)
- Data (数字で見るトライテック + 棒グラフ + ドーナツチャート)
- Company Overview / Access (about-detail.html からfetch)
- Recruit Section (採用情報セクション・選ばれる理由・社員の声・福利厚生など)
- Contact

#### `recruit.html` (独自テーマの黒背景デザイン)
- Hero (タイピングコード・カスタムカーソル)
- 株式会社トライテックが選ばれる理由 (5 cards, 1+4レイアウト)
- 数字で見るトライテック (6 数字 + チャート2つ)
- 案件イメージ (9案件カルーセル・クリックでモーダル)
- 社員の声 (5人カルーセル・クリックでモーダル)
- エンジニアの1日の流れ (5タブ切替)
- 募集要項
- 待遇/休暇 (index.htmlからfetch)
- 入社までの流れ
- Contact

#### `service-{ses,quality,dx}.html`
- Hero (h1 メッセージ・改行調整済み)
- Overview
- Strengths (3つの強み)
- Coverage (タブ切替: 画像+詳細説明)
- Stats (SES のみ・上段2列下段4列)
- Service Flow (SES のみ)
- Support
- Contact

---

## 5. 共通コンポーネント

### 5.1 共通ヘッダ (`_partials/header.html`)

全ページに `<div data-include="header"></div>` を配置すると注入される。

#### メニュー構成
1. ホーム → `index.html`
2. エンジニアの方へ → `index.html#transition-zone`
3. 会社情報 → `about-detail.html`
4. 事業内容 → `service-list.html`
5. お問い合わせ → `contact.html`
6. **採用情報** (CTAボタン) → `recruit.html`

#### 追加機能
- カスタムカーソル (3つの菱形 オレンジ→水色→紺 が遅延付きで追従)
- ロゴ画像 (クリックでゲーム起動)
- モバイル時はハンバーガーメニューに切替

### 5.2 共通フッタ (`_partials/footer.html`)

全ページに `<div data-include="footer"></div>` を配置すると注入される。

#### 構成
- 左カラム: ロゴ + 説明 + RECRUITボタン
- 右カラム: 6リンク (2列×3行グリッド)
  - ホーム / エンジニアの方へ / 会社情報 / 事業内容 / お問い合わせ / プライバシーポリシー
- 下部: コピーライト「© 2026 株式会社トライテック」

### 5.3 注入エンジン (`assets/js/include-partials.js`)

```js
// data-include 属性を持つ要素を探し、_partials/{name}.html を fetch
// 取得したHTMLで slot を置き換え
// 完了後 partials:loaded イベントを発火
```

依存スクリプトは `partials:loaded` イベントで動作開始することで、
注入完了後に DOM操作を行う。

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

/* recruit.html (暗テーマ) */
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

### 7.1 スクリプトの読み込み順序

```html
<script src="assets/js/include-partials.js"></script>     <!-- 共通部品注入 -->
<script src="assets/js/common.js" defer></script>          <!-- 共通機能 -->
<script src="assets/js/contact-embed.js" defer></script>  <!-- Contact注入 -->
<script src="assets/js/coverage-tabs.js" defer></script>  <!-- (service系のみ) -->
<script src="assets/js/pages/index.js" defer></script>    <!-- (index.htmlのみ) -->
<script src="assets/js/game.js" defer></script>           <!-- ゲーム -->
```

### 7.2 各スクリプトの役割

| ファイル | 主な機能 |
|---|---|
| `include-partials.js` | `data-include="..."` 要素を `_partials/*.html` で置換 |
| `common.js` | カスタムカーソル / ハンバーガーメニュー / スクロールプログレス |
| `contact-embed.js` | `data-embed="contact"` を index.html#contact で置換 |
| `coverage-tabs.js` | service ページの Coverage タグをホバー/タップで切替 |
| `pages/index.js` | データチャート / カウントアップ / 会社情報 fetch |
| `game.js` | 隠しシューティングゲーム本体 |

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
| 会社概要・アクセス | `about-detail.html` の各セクション | `index.html` | fetch + DOM置換 |
| 社員の声 (VOICE_DATA) | `assets/js/pages/index.js` | `recruit.html` | fetch + 正規表現 + eval |
| 案件データ (PROJECT_DATA) | `recruit.html` 内 IIFE (`window.PROJECT_DATA` 公開) | recruit.html内3箇所 (カード/モーダル/ターミナル) | window参照 |
| Contact セクション | `index.html` の `#contact` | service-{list,ses,quality,dx}.html | fetch + DOM抽出 |
| 待遇・休暇 (li) | `index.html` の `#sec-benefits` | `recruit.html` | fetch + li抽出 |
| 数字データ (.dc) | `index.html` の `#data` | `recruit.html` | fetch + チャート再描画 |
| 選ばれる理由 (.reason-card) | `index.html` の `#sec-reason` | `recruit.html` | fetch + title/body抽出 |

### 8.2 設計判断の理由

- **DRY (Don't Repeat Yourself)** 原則の徹底
- 仕様変更時のメンテ工数を最小化
- 整合性の自動担保（手動コピーミスを防止）

---

## 9. お問い合わせフォーム仕様

### 9.1 構成

```
[ユーザー: contact.html]
    ↓ POST (JSON, text/plain)
[Google Apps Script Web App]
    ↓ MailApp.sendEmail × 2
[① info@tritechinc.jp (Microsoft 365) ... 社内通知]
[② ユーザーのメールアドレス ... サンキューメール (自動返信)]
```

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

### 9.3 GAS エンドポイント

- ファイル: `_partials/contact-form-gas.js`
- ⚠️ 機密性のため URL は本仕様書には記載せず、`contact.html` 内の `GAS_ENDPOINT` 定数で管理
- 設定詳細・運用は社内資料 `GAS_セットアップ手順.txt` 参照

### 9.4 セキュリティ

- HTML5 標準バリデーション + JS による必須チェック
- スパム対策: メッセージにURL 3つ以上で送信拒否
- プライバシーポリシー同意必須
- HTTPS でのみ送信（GitHub Pages SSL）

---

## 10. ホスティング・DNS

### 10.1 GitHub Pages

| 項目 | 内容 |
|---|---|
| リポジトリ | `limacon-products/tritech-hp` |
| ブランチ | `main` |
| ビルド | なし（静的HTMLそのまま配信） |
| デプロイ | `git push` で自動 |
| SSL | Let's Encrypt 自動発行 |
| カスタムドメイン | `tritechinc.jp` (CNAMEファイル配置済み) |

### 10.2 DNS設定 (お名前.com)

```
# A レコード (GitHub Pages のIP - 4つ全て登録)
@  A  185.199.108.153
@  A  185.199.109.153
@  A  185.199.110.153
@  A  185.199.111.153

# CNAME (www サブドメイン)
www  CNAME  limacon-products.github.io.

# MX (メール受信 - Microsoft 365)
@  MX  10  tritechinc-jp.mail.protection.outlook.com

# SPF (メール送信元認証)
@  TXT  v=spf1 include:spf.protection.outlook.com include:_spf.google.com ~all

# DMARC (なりすまし対策・推奨追加)
_dmarc  TXT  v=DMARC1; p=none; rua=mailto:info@tritechinc.jp; ruf=mailto:info@tritechinc.jp; fo=1
```

---

## 11. ローカル開発

### 11.1 環境構築

特別なツール不要。HTTPサーバが起動できればOK。

```bash
# Python 3 で起動 (推奨)
python -m http.server 8000

# Node.js なら
npx http-server -p 8000

# ブラウザで http://localhost:8000/ を開く
```

⚠️ `fetch()` を使う共通部品注入機能があるため、必ず HTTP サーバ経由で開くこと。
`file://` プロトコルでは CORS エラーで共通部品が表示されません。

### 11.2 開発フロー

```bash
# 1. リポジトリをクローン
git clone https://github.com/limacon-products/tritech-hp.git
cd tritech-hp

# 2. 編集

# 3. ローカル確認
python -m http.server 8000

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
| フッタリンク変更 | `_partials/footer.html` |
| 会社情報変更 | `about-detail.html` (index.htmlにも自動反映) |
| 社員の声追加 | `assets/js/pages/index.js` の `VOICE_DATA` |
| 案件追加・更新 | `recruit.html` 内の `PROJECT_DATA` |
| メインカラー変更 | `assets/css/common.css` の CSS変数 |
| お問い合わせフォーム項目追加 | `contact.html` の form と `_partials/contact-form-gas.js` の両方 |

### 13.2 トラブル対応

| 症状 | 確認箇所 |
|---|---|
| 画像が表示されない | パスの大文字小文字 (GitHub Pagesは区別する) |
| お問い合わせ送信失敗 | GAS の「アクセスできるユーザー」が「全員」か |
| サンキューメールが届かない | `ENABLE_THANKYOU = true` か |
| ヘッダが表示されない | HTTP経由でアクセスしているか (file://は NG) |
| 社員の声が出ない | index.js の `VOICE_DATA` の構文確認 |

### 13.3 既知の制約

- **JavaScript必須**: 共通部品注入に依存。JSオフのブラウザでは正常表示できない（許容）
- **IE11非対応**: ES2020+ 機能を多用。サポートしない
- **静的サイト**: 動的データ取得には別途バックエンド（GAS等）が必要
- **GitHub Pages帯域制限**: 月100GB（通常範囲では問題なし）

### 13.4 関連ドキュメント

| ファイル | 公開/社内 | 内容 |
|---|---|---|
| `README.md` | 公開 | リポジトリトップ |
| `docs/SPEC.md` | 公開 | 本仕様書 |
| `_partials/contact-form-gas.js` | 公開 | GASに貼るコード本体 |
| `GAS_セットアップ手順.txt` | 社内のみ | GAS初期設定手順 |
| `リリース手順.txt` | 社内のみ | リリース時の手順 |
| `プロジェクト経緯まとめ.txt` | 社内のみ | 開発経緯・判断記録 |

---

## 改訂履歴

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-05-17 | 1.0.0 | 初版 |

---

## 連絡先

- **サイト管理**: 株式会社トライテック (info@tritechinc.jp)
- **開発**: 株式会社Limaçon 清水 幸秀 (shimizu@limacon.co.jp)

---

&copy; 2026 株式会社トライテック. All rights reserved.
