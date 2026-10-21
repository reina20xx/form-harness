-- Form Harness D1 Schema: Conversational Forms & AI Lead Scoring Engine

CREATE TABLE IF NOT EXISTS forms (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  steps_json TEXT NOT NULL,
  webhook_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  budget_range TEXT NOT NULL,
  timeline TEXT NOT NULL,
  team_size TEXT NOT NULL,
  use_case TEXT NOT NULL,
  lead_score INTEGER NOT NULL,
  tier TEXT NOT NULL,
  ai_summary TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  auto_reply_draft TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  routed_channels TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS routing_logs (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  dispatched_at TEXT NOT NULL
);

INSERT OR IGNORE INTO forms (id, title, description, steps_json, webhook_url, created_at) VALUES (
  'form_b2b_enterprise',
  'エンタープライズ導入・無料相談フォーム',
  'わずか60秒の対話形式で、貴社に最適なプランとAI自動見積もりを即時発行します。',
  '[{"step":1,"field":"budget_range","question":"ご想定されている月額予算感を教えてください"},{"step":2,"field":"timeline","question":"導入のご希望時期はいつ頃ですか？"},{"step":3,"field":"team_size","question":"ご利用予定のチーム規模を教えてください"},{"step":4,"field":"use_case","question":"解決したい課題やご相談内容をお聞かせください"}]',
  'https://hooks.slack.com/services/T000/B000/FORM_HARNESS',
  '2026-10-21T00:00:00.000Z'
);
