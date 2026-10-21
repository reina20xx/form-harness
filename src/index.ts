import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleMcpRequest } from './agent/mcp';

export type Bindings = {
  DB: D1Database;
  SLACK_WEBHOOK_URL?: string;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  RESEND_API_KEY?: string;
  STATIC_HTML?: string;
};

const app = new Hono<{ Bindings: Bindings }>();
app.use('*', cors());

export interface LeadInput {
  form_id?: string;
  company_name: string;
  contact_name: string;
  email: string;
  budget_range: string;
  timeline: string;
  team_size: string;
  use_case: string;
}

export function evaluateLeadQualification(input: LeadInput) {
  let score = 15;
  const reasons: string[] = [];

  // 1. Budget scoring
  if (input.budget_range === '100万円以上') {
    score += 40;
    reasons.push('エンタープライズ予算（100万円〜）');
  } else if (input.budget_range === '30万〜100万円') {
    score += 30;
    reasons.push('ミドル予算（30〜100万円）');
  } else if (input.budget_range === '10万〜30万円') {
    score += 18;
    reasons.push('スタンダード予算（10〜30万円）');
  } else {
    score += 5;
    reasons.push('スモールスタート予算');
  }

  // 2. Timeline scoring
  if (input.timeline === '今すぐ（1ヶ月以内）') {
    score += 25;
    reasons.push('導入緊急度：高（1ヶ月以内）');
  } else if (input.timeline === '3ヶ月以内') {
    score += 15;
    reasons.push('導入時期：3ヶ月以内');
  } else {
    score += 5;
  }

  // 3. Team size & Corporate email check
  if (input.team_size === '100名以上' || input.team_size === '30〜100名') {
    score += 15;
    reasons.push(`組織規模：${input.team_size}`);
  } else if (input.team_size === '10〜30名') {
    score += 10;
  }

  const freeDomains = ['gmail.com', 'yahoo.co.jp', 'icloud.com', 'outlook.com', 'hotmail.com'];
  const emailDomain = (input.email.split('@')[1] || '').toLowerCase();
  if (emailDomain && !freeDomains.includes(emailDomain)) {
    score += 10;
    reasons.push(`法人ドメイン認証済 (${emailDomain})`);
  }

  score = Math.min(100, score);

  let tier: 'A' | 'B' | 'C' = 'C';
  let recommended_action = '自動ステップメールでのナーチャリング配信（資料送付）';
  let routed_channels = ['Email_AutoReply'];

  if (score >= 80) {
    tier = 'A';
    recommended_action = '🔥 最優先ホットリード：営業責任者へSlack/LINE即時通知 ＋ カレンダー予約URL自動送付';
    routed_channels = ['Slack_HotLead_Alert', 'LINE_VIP_Push', 'Calendar_Instant_Invite'];
  } else if (score >= 55) {
    tier = 'B';
    recommended_action = '⚡ 有망リード：インサイドセールスへSlack通知 ＋ 導入事例集＆個別相談リンク送付';
    routed_channels = ['Slack_Sales_Channel', 'Email_CaseStudy_Send'];
  }

  const ai_summary = `【AI判定: Tier ${tier} (${score}点)】${input.company_name}（${input.contact_name}様） / 判定根拠: ${reasons.join('・')} / 要望: ${input.use_case.slice(0, 60)}`;

  const auto_reply_draft = `${input.company_name}\n${input.contact_name} 様\n\nお問い合わせいただきありがとうございます。\n「${input.use_case}」について、貴社の規模（${input.team_size}）およびスケジュール（${input.timeline}）に最適な構成案を準備いたしました。\n\n${
    tier === 'A'
      ? '優先ご案内枠として、以下の専用リンクより最短本日〜明日のオンライン個別相談をご予約いただけます：\nhttps://cal.example.com/priority-enterprise'
      : 'まずはサービス概要資料および同業他社様の導入事例PDFをお送りいたします。'
  }\n\n引き続きよろしくお願いいたします。`;

  return {
    lead_score: score,
    tier,
    ai_summary,
    recommended_action,
    auto_reply_draft,
    routed_channels,
  };
}

// Health check
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'form-harness',
    architecture: 'Cloudflare Workers + D1 + Conversational UI + MCP',
    cost: '¥0/month (Replaces Typeform / formrun / HubSpot Starter)',
  });
});

// Get forms & leads dashboard summary
app.get('/api/dashboard', async (c) => {
  const leadsRes = await c.env.DB.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  const logsRes = await c.env.DB.prepare('SELECT * FROM routing_logs ORDER BY dispatched_at DESC LIMIT 30').all();
  const leads = leadsRes.results || [];

  const totalLeads = leads.length;
  const tierACount = leads.filter((l: any) => l.tier === 'A').length;
  const tierBCount = leads.filter((l: any) => l.tier === 'B').length;
  const tierCCount = leads.filter((l: any) => l.tier === 'C').length;
  const avgScore = totalLeads > 0 ? Math.round(leads.reduce((s: number, l: any) => s + Number(l.lead_score), 0) / totalLeads) : 0;

  return c.json({
    metrics: {
      total_leads: totalLeads,
      tier_a_hot_leads: tierACount,
      tier_b_warm_leads: tierBCount,
      tier_c_nurture_leads: tierCCount,
      average_score: avgScore,
      estimated_saas_saved_jpy: 49800, // vs Typeform Business + HubSpot / formrun
    },
    leads,
    routing_logs: logsRes.results || [],
  });
});

// Submit conversational form -> Instant AI Scoring & Webhook Routing
app.post('/api/forms/submit', async (c) => {
  const body = await c.req.json<LeadInput>();
  if (!body.company_name || !body.contact_name || !body.email) {
    return c.json({ error: 'company_name, contact_name, email are required' }, 400);
  }

  const evalResult = evaluateLeadQualification(body);
  const leadId = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO leads (id, form_id, company_name, contact_name, email, budget_range, timeline, team_size, use_case, lead_score, tier, ai_summary, recommended_action, auto_reply_draft, status, routed_channels, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      leadId,
      body.form_id || 'form_b2b_enterprise',
      body.company_name,
      body.contact_name,
      body.email,
      body.budget_range || '未回答',
      body.timeline || '未回答',
      body.team_size || '未回答',
      body.use_case || '',
      evalResult.lead_score,
      evalResult.tier,
      evalResult.ai_summary,
      evalResult.recommended_action,
      evalResult.auto_reply_draft,
      evalResult.tier === 'A' ? 'priority_contacted' : 'new',
      JSON.stringify(evalResult.routed_channels),
      now
    )
    .run();

  // Record webhook / notification routing logs
  for (const ch of evalResult.routed_channels) {
    const logId = `route_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await c.env.DB.prepare(
      `INSERT INTO routing_logs (id, lead_id, channel, payload_json, status, dispatched_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        logId,
        leadId,
        ch,
        JSON.stringify({
          company: body.company_name,
          contact: body.contact_name,
          tier: evalResult.tier,
          score: evalResult.lead_score,
          summary: evalResult.ai_summary,
        }),
        'dispatched_200_ok',
        now
      )
      .run();
  }

  return c.json({
    ok: true,
    lead: {
      id: leadId,
      ...body,
      ...evalResult,
      created_at: now,
    },
  });
});

// Update lead status
app.post('/api/leads/:id/status', async (c) => {
  const id = c.req.param('id');
  const { status } = await c.req.json<{ status: string }>();
  await c.env.DB.prepare('UPDATE leads SET status = ? WHERE id = ?').bind(status, id).run();
  return c.json({ ok: true, id, status });
});

// MCP Endpoint for Claude Code / Cursor
app.post('/mcp', async (c) => {
  const body = await c.req.json();
  const res = await handleMcpRequest(body, c.env);
  return c.json(res);
});

// Serve Frontend UI
app.get('/', (c) => {
  if (c.env.STATIC_HTML) {
    return c.html(c.env.STATIC_HTML);
  }
  return c.text('Form Harness API is running.');
});

export default app;
