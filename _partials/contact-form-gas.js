/**
 * ════════════════════════════════════════════════════════
 *  株式会社トライテック お問い合わせフォーム送信 GAS スクリプト
 *  Microsoft Graph API 経由で info@tritechinc.jp として送信
 *  → Google Apps Script (https://script.google.com) にコピー
 * ════════════════════════════════════════════════════════
 *
 * ◆ 動作の流れ
 *   contact.html フォーム
 *      ↓ POST (JSON)
 *   GAS (この doPost)
 *      ↓ Microsoft Graph API (OAuth2 Client Credentials)
 *   Exchange Online (info@tritechinc.jp として送信)
 *      ↓ DKIM/SPF/DMARC 全 pass
 *   受信者の受信箱 (迷惑メール扱いされない)
 *
 * ◆ セットアップ手順
 *   詳細は「Microsoft_Graph_API_セットアップ手順.txt」を参照
 *
 *   1. https://script.google.com を開く（Googleアカウントでログイン）
 *   2.「新しいプロジェクト」をクリック
 *   3. このファイルの中身を全てコピーして、コード.gs に貼り付ける
 *   4. プロジェクト設定 (左メニュー歯車) → 「スクリプト プロパティ」
 *      以下を追加:
 *        - TENANT_ID         : (Microsoft_Graph_API_セットアップ手順.txt の
 *                                ディレクトリ(テナント) ID)
 *        - CLIENT_ID         : (アプリケーション(クライアント) ID)
 *        - CLIENT_SECRET     : (クライアント シークレットの値)
 *        - RECAPTCHA_SECRET  : (Google reCAPTCHA v3 のシークレットキー)
 *          ※ ENABLE_RECAPTCHA = false にすればこの設定はスキップ可能
 *   5. 上部の「保存」(💾)、プロジェクト名は「トライテック お問い合わせ」など
 *   6. 「デプロイ」→「新しいデプロイ」をクリック
 *   7. 種類の選択(歯車) → 「ウェブアプリ」
 *   8. 設定:
 *        - 説明: お問い合わせフォーム (Graph API版)
 *        - 実行するユーザー: 自分
 *        - アクセスできるユーザー: 全員
 *   9. 「デプロイ」をクリック → 権限を許可
 *  10. 表示される「ウェブアプリURL」をコピー
 *  11. contact.html の GAS_ENDPOINT 変数にそのURLを貼り付けて保存
 *  12. テスト送信して動作確認
 *
 * ◆ メンテナンス
 *   - 送信先メールアドレスを変えたい: TO_EMAIL を編集
 *   - 件名プレフィックスを変えたい: SUBJECT_PREFIX を編集
 *   - サンキューメール本文を変えたい: buildThankYouBody() を編集
 *   - サンキューメールを止めたい: ENABLE_THANKYOU = false
 *   - クライアントシークレットは24か月で期限切れ → 2028年4月頃に更新
 *   - reCAPTCHA を無効化したい: ENABLE_RECAPTCHA = false
 *   - reCAPTCHA の判定厳しさを調整: RECAPTCHA_MIN_SCORE (0.0〜1.0)
 *     大きいほど厳格 (= 人間でも弾かれやすい)、小さいほど緩い
 */

/* ====== 設定 ======
 * 送信元・受信先ともに info@tritechinc.jp
 * Microsoft Graph API 経由なので Exchange Online から正規に送信される
 *   → DKIM 自動署名、SPF/DMARC pass、迷惑メール扱いされない
 */
const SENDER_EMAIL = 'info@tritechinc.jp';                    // Graph API で送信元として指定するアドレス
const TO_EMAIL = 'info@tritechinc.jp';                        // 社内受信先
const FROM_NAME = '株式会社トライテック';                      // 送信者表示名
const SUBJECT_PREFIX = '【HP問い合わせ】';                     // 社内通知の件名プレフィックス
const ENABLE_THANKYOU = true;                                 // サンキューメール自動返信 ON/OFF
const THANKYOU_SUBJECT = '【株式会社トライテック】お問い合わせを受け付けました';
const COMPANY_NAME = '株式会社トライテック';
const COMPANY_URL  = 'https://tritechinc.jp/';                // 会社URL(署名用)
const SUPPORT_HOURS = '平日 10:00 〜 18:00（土日祝・年末年始除く）';
const REPLY_DEADLINE = '1週間以内';
const ENABLE_SHEET_LOG = false;                               // スプレッドシート保存ON/OFF
const SHEET_ID = '';                                          // 保存する場合のシートID
const ENABLE_RECAPTCHA = true;                                // reCAPTCHA v3 検証 ON/OFF
const RECAPTCHA_MIN_SCORE = 0.5;                              // 0.0(bot)〜1.0(人間)、未満は拒否
/* =================== */

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const data = JSON.parse(raw);

    // 必須項目チェック
    const required = ['type', 'name', 'email', 'message'];
    for (const k of required) {
      if (!data[k] || String(data[k]).trim() === '') {
        return jsonResponse({ ok: false, error: 'missing: ' + k });
      }
    }

    // 簡易スパム対策: メッセージにURLが3つ以上含まれていたら拒否
    const urlCount = (String(data.message).match(/https?:\/\//g) || []).length;
    if (urlCount >= 3) {
      return jsonResponse({ ok: false, error: 'too many URLs' });
    }

    // reCAPTCHA v3 検証 (スコア閾値未満は拒否)
    if (ENABLE_RECAPTCHA) {
      const verifyResult = verifyRecaptcha(data.recaptchaToken);
      if (!verifyResult.ok) {
        console.warn('[recaptcha] rejected:', verifyResult);
        return jsonResponse({ ok: false, error: 'recaptcha failed: ' + verifyResult.reason });
      }
    }

    // アクセストークン取得 (キャッシュ利用)
    const token = getGraphAccessToken();

    // ① 社内通知メール (info@tritechinc.jp 宛、Reply-To は送信者)
    sendMailViaGraph(token, {
      to: TO_EMAIL,
      subject: SUBJECT_PREFIX + ' ' + data.type + ' / ' + data.name,
      body: buildInternalNoticeBody(data),
      replyTo: data.email,
    });

    // ② サンキューメール (送信者宛、Reply-To は社内固定)
    if (ENABLE_THANKYOU) {
      try {
        sendMailViaGraph(token, {
          to: data.email,
          subject: THANKYOU_SUBJECT,
          body: buildThankYouBody(data),
          replyTo: TO_EMAIL,
        });
      } catch (e) {
        // サンキュー送信失敗は致命的でないので、社内通知は成功扱い
        console.error('[sendThankYou] FAILED:', e, 'to:', data.email);
      }
    }

    if (ENABLE_SHEET_LOG && SHEET_ID) {
      logToSheet(data);
    }

    return jsonResponse({ ok: true });

  } catch (err) {
    console.error('[doPost]', err);
    return jsonResponse({ ok: false, error: String(err) });
  }
}

/* ════════════════════════════════════════════
 *  reCAPTCHA v3 トークン検証
 *  Google の siteverify API にトークンを送信してスコアを取得
 *    - スコアが RECAPTCHA_MIN_SCORE 未満なら拒否
 *    - action 名が一致しない場合も拒否
 *    - シークレットキーは Script Properties (RECAPTCHA_SECRET) に格納
 *  返り値: { ok: true } または { ok: false, reason: '...' }
 * ════════════════════════════════════════════ */
function verifyRecaptcha(token) {
  if (!token) {
    return { ok: false, reason: 'no token' };
  }
  const secret = PropertiesService.getScriptProperties().getProperty('RECAPTCHA_SECRET');
  if (!secret) {
    console.warn('[recaptcha] RECAPTCHA_SECRET not set in Script Properties');
    return { ok: false, reason: 'server config missing' };
  }
  try {
    const res = UrlFetchApp.fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'post',
      payload: { secret: secret, response: token },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) {
      return { ok: false, reason: 'siteverify HTTP ' + res.getResponseCode() };
    }
    const json = JSON.parse(res.getContentText());
    if (!json.success) {
      return { ok: false, reason: 'success=false ' + JSON.stringify(json['error-codes'] || []) };
    }
    if (json.action !== 'contact_submit') {
      return { ok: false, reason: 'action mismatch: ' + json.action };
    }
    if (typeof json.score !== 'number' || json.score < RECAPTCHA_MIN_SCORE) {
      return { ok: false, reason: 'low score: ' + json.score };
    }
    console.log('[recaptcha] passed (score=' + json.score + ')');
    return { ok: true, score: json.score };
  } catch (e) {
    return { ok: false, reason: 'exception: ' + e };
  }
}

/* ════════════════════════════════════════════
 *  Microsoft Graph API: アクセストークン取得
 *  Client Credentials フロー (OAuth 2.0)
 *  トークンは約1時間有効。CacheService でキャッシュして
 *  毎リクエストで取得しないようにする。
 * ════════════════════════════════════════════ */
function getGraphAccessToken() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('graph_access_token');
  if (cached) return cached;

  const props = PropertiesService.getScriptProperties();
  const tenantId = props.getProperty('TENANT_ID');
  const clientId = props.getProperty('CLIENT_ID');
  const clientSecret = props.getProperty('CLIENT_SECRET');

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Script Properties (TENANT_ID/CLIENT_ID/CLIENT_SECRET) が未設定です');
  }

  const tokenUrl = 'https://login.microsoftonline.com/' + tenantId + '/oauth2/v2.0/token';
  const res = UrlFetchApp.fetch(tokenUrl, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    },
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() !== 200) {
    throw new Error('Token取得失敗: HTTP ' + res.getResponseCode() + ' - ' + res.getContentText());
  }

  const json = JSON.parse(res.getContentText());
  const token = json.access_token;
  if (!token) throw new Error('Token取得失敗: access_token なし');

  // expires_in より少し短めにキャッシュ (3300秒 = 55分)
  const ttl = Math.min(3300, Math.max(60, (json.expires_in || 3600) - 300));
  cache.put('graph_access_token', token, ttl);

  return token;
}

/* ════════════════════════════════════════════
 *  Microsoft Graph API: メール送信
 *  POST /users/{sender}/sendMail
 * ════════════════════════════════════════════ */
function sendMailViaGraph(token, opts) {
  const url = 'https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(SENDER_EMAIL) + '/sendMail';
  const message = {
    subject: opts.subject,
    body: {
      contentType: 'Text',
      content: opts.body,
    },
    from: {
      emailAddress: { address: SENDER_EMAIL, name: FROM_NAME },
    },
    toRecipients: [
      { emailAddress: { address: opts.to } },
    ],
  };
  if (opts.replyTo) {
    message.replyTo = [
      { emailAddress: { address: opts.replyTo } },
    ];
  }
  const payload = {
    message: message,
    saveToSentItems: true,
  };

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  // sendMail は成功時 202 Accepted
  if (code !== 202 && code !== 200) {
    throw new Error('sendMail失敗: HTTP ' + code + ' - ' + res.getContentText());
  }
}

/* ════════════════════════════════════════════
 *  メール本文ビルダー
 * ════════════════════════════════════════════ */
function buildInternalNoticeBody(data) {
  return [
    'ホームページのお問い合わせフォームから新規受信しました。',
    '',
    '────────────────────────────',
    '【お問い合わせ種別】 ' + data.type,
    '【お名前】          ' + data.name,
    '【会社名】          ' + (data.company || '(未記入)'),
    '【メールアドレス】  ' + data.email,
    '【電話番号】        ' + (data.tel || '(未記入)'),
    '────────────────────────────',
    '',
    '【お問い合わせ内容】',
    data.message,
    '',
    '────────────────────────────',
    '送信日時: ' + (data.sentAt || new Date().toISOString()),
    'User-Agent: ' + (data.userAgent || '-'),
    '',
    '※ 返信される場合は、このメールに「返信」してください。',
  ].join('\n');
}

function buildThankYouBody(data) {
  return [
    data.name + ' 様',
    '',
    'この度は ' + COMPANY_NAME + ' へお問い合わせいただき、',
    '誠にありがとうございます。',
    '',
    '以下の内容でお問い合わせを受け付けました。',
    '担当者より ' + REPLY_DEADLINE + ' にご返信いたします。',
    '今しばらくお待ちくださいませ。',
    '',
    '────────────────────────────',
    '【お問い合わせ種別】 ' + data.type,
    '【お名前】          ' + data.name,
    '【会社名】          ' + (data.company || '(未記入)'),
    '【メールアドレス】  ' + data.email,
    '【電話番号】        ' + (data.tel || '(未記入)'),
    '────────────────────────────',
    '',
    '【お問い合わせ内容】',
    data.message,
    '',
    '────────────────────────────',
    '',
    '※ このメールは自動送信されています。',
    '   このメールに直接ご返信いただいても、',
    '   担当者には届きません。',
    '   追加のお問い合わせは下記までお願いいたします。',
    '',
    '   ' + TO_EMAIL,
    '   営業時間: ' + SUPPORT_HOURS,
    '',
    '──────────────────────────────────────',
    '  ' + COMPANY_NAME,
    '  ' + COMPANY_URL,
    '──────────────────────────────────────',
  ].join('\n');
}

/* GET でアクセスされた時の応答(疎通確認用) */
function doGet() {
  return jsonResponse({
    ok: true,
    service: 'Tritech Contact Form (Microsoft Graph API)',
    message: 'POST your form data as JSON',
  });
}

/* スプレッドシートに記録する場合の関数 */
function logToSheet(data) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('contacts') || ss.insertSheet('contacts');
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['日時', '種別', 'お名前', '会社名', 'メール', '電話', '内容']);
    }
    sheet.appendRow([
      new Date(),
      data.type,
      data.name,
      data.company || '',
      data.email,
      data.tel || '',
      data.message,
    ]);
  } catch (e) {
    console.error('[logToSheet]', e);
  }
}

/* JSON 応答ヘルパー (CORS 対応) */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ════════════════════════════════════════════
 *  デバッグ用: 手動テスト送信
 *  GAS エディタで「testSend」関数を選択 → 実行ボタン
 *  で info@tritechinc.jp 宛にテストメール送信できる
 * ════════════════════════════════════════════ */
function testSend() {
  const token = getGraphAccessToken();
  console.log('Token取得 OK (先頭20文字): ' + token.substring(0, 20) + '...');
  sendMailViaGraph(token, {
    to: TO_EMAIL,
    subject: '[テスト] Graph API 送信テスト',
    body: 'Microsoft Graph API 経由のテスト送信です。\n\n送信時刻: ' + new Date().toISOString(),
    replyTo: SENDER_EMAIL,
  });
  console.log('送信完了 → ' + TO_EMAIL);
}
