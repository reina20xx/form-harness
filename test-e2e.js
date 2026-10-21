const BASE = process.env.BASE_URL || 'http://localhost:8790';

async function runTests() {
  console.log('=== Form Harness E2E Test Suite ===');

  // 1. Health Check
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
  if (health.status !== 'ok') throw new Error('Health check failed');
  console.log('✅ 1. Health check passed:', health.service);

  // 2. Submit Tier A Enterprise Lead
  const tierARes = await fetch(`${BASE}/api/forms/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_name: '株式会社エンタープライズAI',
      contact_name: '山田 太郎',
      email: 'yamada@enterprise-ai.co.jp',
      budget_range: '100万円以上',
      timeline: '今すぐ（1ヶ月以内）',
      team_size: '100名以上',
      use_case: '全社B2Bリード獲得フォームのAI自動化とSlack/LINE即時ルーティング',
    }),
  }).then((r) => r.json());

  if (!tierARes.ok || tierARes.lead.tier !== 'A' || tierARes.lead.lead_score < 85) {
    throw new Error('Tier A scoring failed: ' + JSON.stringify(tierARes));
  }
  console.log(`✅ 2. Tier A Lead scored (${tierARes.lead.lead_score} pts) & routed to:`, tierARes.lead.routed_channels);

  // 3. Submit Tier C Nurture Lead
  const tierCRes = await fetch(`${BASE}/api/forms/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_name: '個人プロジェクト',
      contact_name: '鈴木 一郎',
      email: 'suzuki@gmail.com',
      budget_range: '10万円未満',
      timeline: '情報収集中',
      team_size: '1〜9名',
      use_case: 'まずは資料を見たい',
    }),
  }).then((r) => r.json());

  if (!tierCRes.ok || tierCRes.lead.tier !== 'C') {
    throw new Error('Tier C scoring failed');
  }
  console.log(`✅ 3. Tier C Lead scored (${tierCRes.lead.lead_score} pts) -> Nurture queue`);

  // 4. Test MCP Server tools/call
  const mcpRes = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'generate_personalized_followup',
        arguments: { lead_id: tierARes.lead.id },
      },
    }),
  }).then((r) => r.json());

  const followup = JSON.parse(mcpRes.result.content[0].text);
  if (!followup.followup_subject.includes('株式会社エンタープライズAI')) {
    throw new Error('MCP followup generation failed');
  }
  console.log('✅ 4. MCP tool generate_personalized_followup verified:', followup.followup_subject);

  console.log('🎉 ALL FORM HARNESS E2E TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('❌ E2E Test failed:', err);
  process.exit(1);
});
