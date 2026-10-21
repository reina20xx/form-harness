import type { Bindings } from '../index';
import { evaluateLeadQualification } from '../index';

export async function handleMcpRequest(req: any, env: Bindings) {
  const { id, method, params } = req;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'form-harness-mcp', version: '1.0.0' },
        capabilities: { tools: {} },
      },
    };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: [
          {
            name: 'list_leads',
            description: 'フォームから獲得したリード一覧をAIスコア・Tier（A/B/C）付きで取得します',
            inputSchema: {
              type: 'object',
              properties: {
                tier: { type: 'string', description: 'A, B, C のいずれかでフィルタ（任意）' },
              },
            },
          },
          {
            name: 'score_and_submit_lead',
            description: '新規リード情報をAIスコアリングし、D1保存とWebhook自動振り分けを実行します',
            inputSchema: {
              type: 'object',
              required: ['company_name', 'contact_name', 'email', 'budget_range', 'timeline', 'team_size', 'use_case'],
              properties: {
                company_name: { type: 'string' },
                contact_name: { type: 'string' },
                email: { type: 'string' },
                budget_range: { type: 'string' },
                timeline: { type: 'string' },
                team_size: { type: 'string' },
                use_case: { type: 'string' },
              },
            },
          },
          {
            name: 'generate_personalized_followup',
            description: '指定したリードIDに対して、課題と予算に最適化した個別フォローアップ文面を再生成します',
            inputSchema: {
              type: 'object',
              required: ['lead_id'],
              properties: { lead_id: { type: 'string' } },
            },
          },
          {
            name: 'get_conversion_funnel_stats',
            description: 'Tier別のリード件数・平均スコア・Webhook配信ログ統計を取得します',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      },
    };
  }

  if (method === 'tools/call') {
    const toolName = params?.name;
    const args = params?.arguments || {};

    if (toolName === 'list_leads') {
      const q = args.tier
        ? env.DB.prepare('SELECT * FROM leads WHERE tier = ? ORDER BY lead_score DESC').bind(args.tier)
        : env.DB.prepare('SELECT * FROM leads ORDER BY lead_score DESC');
      const res = await q.all();
      return {
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: JSON.stringify(res.results || [], null, 2) }] },
      };
    }

    if (toolName === 'score_and_submit_lead') {
      const evalResult = evaluateLeadQualification(args);
      const leadId = `lead_mcp_${Date.now()}`;
      const now = new Date().toISOString();
      await env.DB.prepare(
        `INSERT INTO leads (id, form_id, company_name, contact_name, email, budget_range, timeline, team_size, use_case, lead_score, tier, ai_summary, recommended_action, auto_reply_draft, status, routed_channels, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          leadId,
          'form_b2b_enterprise',
          args.company_name,
          args.contact_name,
          args.email,
          args.budget_range,
          args.timeline,
          args.team_size,
          args.use_case,
          evalResult.lead_score,
          evalResult.tier,
          evalResult.ai_summary,
          evalResult.recommended_action,
          evalResult.auto_reply_draft,
          'priority_contacted',
          JSON.stringify(evalResult.routed_channels),
          now
        )
        .run();

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify({ lead_id: leadId, ...evalResult }, null, 2) }],
        },
      };
    }

    if (toolName === 'generate_personalized_followup') {
      const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(args.lead_id).first<any>();
      if (!lead) {
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'Lead not found' }] } };
      }
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  lead_id: lead.id,
                  company: lead.company_name,
                  tier: lead.tier,
                  score: lead.lead_score,
                  followup_subject: `【${lead.company_name}様専任枠】${lead.use_case.slice(0, 18)}に関するご提案とデモ環境のご案内`,
                  followup_body: lead.auto_reply_draft,
                },
                null,
                2
              ),
            },
          ],
        },
      };
    }

    if (toolName === 'get_conversion_funnel_stats') {
      const leads = (await env.DB.prepare('SELECT * FROM leads').all()).results || [];
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  total: leads.length,
                  tier_A: leads.filter((l: any) => l.tier === 'A').length,
                  tier_B: leads.filter((l: any) => l.tier === 'B').length,
                  tier_C: leads.filter((l: any) => l.tier === 'C').length,
                },
                null,
                2
              ),
            },
          ],
        },
      };
    }
  }

  return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
}
