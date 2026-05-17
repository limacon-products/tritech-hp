/**
 * ════════════════════════════════════════════════════════
 *  株式会社トライテック お問い合わせフォーム送信 GAS スクリプト
 *  → Google Apps Script (https://script.google.com) にコピー
 * ════════════════════════════════════════════════════════
 *
 * ◆ セットアップ手順
 *   1. https://script.google.com を開く（Googleアカウントでログイン）
 *   2.「新しいプロジェクト」をクリック
 *   3. このファイルの中身を全てコピーして、コード.gs に貼り付ける
 *   4. 上部の「保存」(💾)、プロジェクト名は「トライテック お問い合わせ」など
 *   5. 「デプロイ」→「新しいデプロイ」をクリック
 *   6. 種類の選択(歯車) → 「ウェブアプリ」
 *   7. 設定:
 *        - 説明: お問い合わせフォーム
 *        - 実行するユーザー: 自分(=Gmail送信元アカウント)
 *        - アクセスできるユーザー: 全員
 *   8. 「デプロイ」をクリック → 権限を許可
 *   9. 表示される「ウェブアプリURL」をコピー
 *  10. contact.html の GAS_ENDPOINT 変数にそのURLを貼り付けて保存
 *  11. 完了!
 *
 * ◆ メンテナンス
 *   - 送信先メールアドレスを変えたい: TO_EMAIL を編集
 *   - 件名プレフィックスを変えたい: SUBJECT_PREFIX を編集
 *   - スプレッドシートに記録したい場合は logToSheet を有効化
 *   - サンキューメール本文を変えたい: sendThankYouMail() 関数を編集
 *   - サンキューメールを止めたい: ENABLE_THANKYOU = false
 */

/* ====== 設定 ======
 * GAS実行アカウント: info@tritechinc.jp (Google側)
 * 社内受信先     : info@tritechinc.jp (Microsoft側 / MX配信)
 * ※同じアドレスへ送信する構成。Googleの送信済みにも残るので
 *   メーラーで重複表示される場合は社内受信先を変更すること。
 */
const TO_EMAIL = 'info@tritechinc.jp';                       // 社内受信先
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

    // メール本文の組み立て
    const lines = [
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
    ];

    // ① 社内通知メール (info@tritechinc.jp 宛)
    MailApp.sendEmail({
      to: TO_EMAIL,
      subject: SUBJECT_PREFIX + ' ' + data.type + ' / ' + data.name,
      body: lines.join('\n'),
      replyTo: data.email,        // 返信ボタンで顧客に直接返信できるように
      name: FROM_NAME,
    });

    // ② サンキューメール (送信者宛、自動返信)
    if (ENABLE_THANKYOU) {
      sendThankYouMail(data);
    }

    if (ENABLE_SHEET_LOG && SHEET_ID) {
      logToSheet(data);
    }

    return jsonResponse({ ok: true });

  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

/* 送信者宛 サンキューメール (自動返信) */
function sendThankYouMail(data) {
  const body = [
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
  ];
  try {
    /* noReply オプションは Google Workspace 専用なので
       無料 Gmail アカウントだとエラーで送信されない。
       同等の効果は「※このメールは自動送信です」と本文で案内すればOK */
    MailApp.sendEmail({
      to: data.email,
      subject: THANKYOU_SUBJECT,
      body: body.join('\n'),
      replyTo: TO_EMAIL,         // 返信先は社内宛に固定
      name: FROM_NAME,
    });
    console.log('[sendThankYouMail] sent to:', data.email);
  } catch (e) {
    console.error('[sendThankYouMail] FAILED:', e, 'to:', data.email);
    // サンキュー送信失敗は致命的でないので、社内通知は成功扱いにする
  }
}

/* GET でアクセスされた時の応答(疎通確認用) */
function doGet() {
  return jsonResponse({
    ok: true,
    service: 'Tritech Contact Form',
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

/* JSON 応答ヘルパー */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
