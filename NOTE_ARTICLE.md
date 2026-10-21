# 【完全無料・OSS】月額1.5万円のTypeform＆フォーム管理SaaSを不要にする、AIリード採点＆自動振り分けエンジン「Form Harness」を公開しました

B2Bマーケティングや受託開発、SaaS運営において、「問い合わせフォーム・資料請求フォーム」は売上の入り口です。
しかし、離脱率を下げるために **Typeform** や **formrun**、**HubSpot** などの高機能フォームSaaSを導入すると、以下のような「見えない固定費の壁」にぶつかります。

- **回答数（レスポンス数）が増えるたびにプランが跳ね上がる**（月額 $29 〜 $99+）
- フォームから送信された後、**「今すぐ商談すべきホットリード（Tier A）」も「情報収集段階のリード（Tier C）」も同じSlackチャンネルに流れて埋もれる**
- 営業担当者が1件ずつ手動でメールを返信するため、リード獲得から初回アプローチまでに数時間〜1日のタイムラグが発生し、失注する

この課題を根底から解決するため、Cloudflare Workers + D1 の無料枠（月額0円）で動作し、AIエージェント（MCP）から自在に操作できる対話型フォーム＆AIリード自動採点エンジン **「Form Harness」** をMITライセンスのオープンソースとして公開しました！

🔗 **GitHubリポジトリ**: https://github.com/reina20xx/form-harness

---

## Form Harness でできること（4つのコア機能）

### 1. 回答数無制限・エッジ高速配信の「対話型フォームUI」
Typeformのようなステップ形式・60秒ヒアリングUIをCloudflareエッジから直接配信します。月間100件でも10万件でも、Cloudflareの無料枠内ならランニングコストは **0円** です。

### 2. 0〜100点のリアルタイムAIリードスコアリング（Tier A / B / C 判定）
フォームが送信された瞬間に、エッジワーカー上で以下の要素を自動解析してスコアリングします。

- **予算規模**: エンタープライズ（100万円以上）〜 スモールスタート
- **導入緊急度**: 今すぐ（1ヶ月以内）〜 情報収集中
- **組織規模・法人ドメイン認証**: フリーメール（gmail等）か独自法人ドメインかを自動識別

```typescript
// Tier A (80点以上) のホットリードは秒速で優先レーンへルーティング
if (score >= 80) {
  tier = 'A';
  recommended_action = '🔥 最優先ホットリード：営業責任者へSlack/LINE即時通知 ＋ カレンダー予約URL自動送付';
  routed_channels = ['Slack_HotLead_Alert', 'LINE_VIP_Push', 'Calendar_Instant_Invite'];
}
```

### 3. Tier別のWebhook自動ルーティング＆パーソナライズ返信ドラフト生成
- **Tier A（80点以上）**: 営業責任者のSlack / LINEへ即座にアラートを飛ばし、最短当日〜翌日の「優先オンライン商談カレンダー予約URL」を差し込んだ返信文面を自動生成。
- **Tier B（55〜79点）**: インサイドセールスへ通知し、同業他社の導入事例集PDFを送付。
- **Tier C（54点以下）**: 自動ステップメールのナーチャリングレーンへ振り分け。

### 4. Claude Code / Cursor と直結する「MCP Server」内蔵
管理画面を開かなくても、普段使っているAIエディタ（Claude Code や Cursor）から自然言語でリード管理が完結します。

- 「今日入ったTier Aのリード一覧を出して」➔ `list_leads`
- 「株式会社ネクストクラウドの佐藤様向けに、課題に合わせた個別提案メールを作って」➔ `generate_personalized_followup`
- 「今週のフォーム転換率とTier別の内訳を集計して」➔ `get_conversion_funnel_stats`

---

## コスト比較：既存SaaS vs Form Harness

- **Typeform Plus / Business + formrun 等**: 月額 15,000円〜49,800円（年間 約18万〜60万円）
- **Form Harness (Cloudflare Workers + D1)**: **月額 0円**（回答数上限なし・セルフホスト）

---

## 5分で試せるクイックスタート

```bash
git clone https://github.com/reina20xx/form-harness.git
cd form-harness
npm install
npm run dev
```

ブラウザで `http://localhost:8790` を開くと、対話型フォームのプレビュー画面と、リアルタイムに採点・振り分けされるAIリードダッシュボードをすぐに体験できます。

また、同梱のE2Eテストスイート（`node test-e2e.js`）を実行すれば、Tier A / Tier C リードの自動判定からMCPツールの呼び出しまで一発で検証可能です。

---

## まとめ：「フォームを作って終わり」から「AIが即商談化するフォーム」へ

これまで発売・公開してきた「Harness」シリーズ（Reserve Harness / EC Harness / Sign Harness）と同様、Form Harnessも **「高額なSaaS固定費をゼロにし、浮いた予算とAIの力で事業の本質的な成長を加速させる」** ために設計しました。

自社のLPやコーポレートサイト、クライアントワークのリード獲得基盤としてぜひ自由にご活用ください！

🔗 **GitHub**: https://github.com/reina20xx/form-harness
（ぜひ Star ⭐ をいただけると今後のOSS開発の励みになります！）
