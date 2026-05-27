export interface Subscription {
  id: number;
  name: string;
  category: string;
  amount: number;
  billing_cycle: 'monthly' | 'yearly' | 'weekly' | 'quarterly';
  next_payment_date: string | null;
  payment_method: string;
  status: 'active' | 'paused' | 'cancelled';
  cancel_method: 'url' | 'email' | 'automation' | null;
  cancel_url: string | null;
  cancel_email: string | null;
  anbieter_address: string | null;
  kundennummer: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: number;
  name: string;
  internal_url: string | null;
  external_url: string | null;
  hosting_location: string | null;
  server_name: string | null;
  category: 'Media' | 'Storage' | 'Monitoring' | 'Security' | 'Productivity' | 'Infrastructure' | 'Other';
  status: 'up' | 'down' | 'unknown';
  last_checked: string | null;
  last_status_code: number | null;
  last_latency_ms: number | null;
  version: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ServiceCheck {
  id: number;
  service_id: number;
  checked_at: string;
  status_code: number | null;
  latency_ms: number | null;
  success: boolean;
}

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

export interface StatusHistoryEntry {
  id: number;
  project_id: number;
  status: string;
  changed_at: string;
}

export interface Project {
  id: number;
  title: string;
  status: 'ideas' | 'planning' | 'active' | 'on_hold' | 'done';
  priority: 'P1' | 'P2' | 'P3';
  tags: string[];
  progress: number;
  due_date: string | null;
  notes: string | null;
  subtasks: Subtask[];
  github_url: string | null;
  github_token: string | null;
  notion_url: string | null;
  linear_url: string | null;
  status_history?: StatusHistoryEntry[];
  created_at: string;
  updated_at: string;
}

export interface SocialAccount {
  id: number;
  platform: string;
  username: string;
  follower_count: number;
  account_email: string | null;
  status: 'active' | 'inactive' | 'suspended';
  profile_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Automation {
  id: number;
  name: string;
  description: string | null;
  tool: 'n8n' | 'make' | 'zapier' | 'custom';
  webhook_url: string | null;
  workflow_id: string | null;
  script_body: string | null;
  status: 'active' | 'paused';
  last_run_at: string | null;
  last_run_result: 'success' | 'failure' | null;
  last_run_output: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: number;
  invoice_number: string | null;
  vendor: string;
  amount: number;
  due_date: string | null;
  status: 'paid' | 'pending' | 'overdue';
  category: string | null;
  notes: string | null;
  matched_transaction_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface BankTransaction {
  id: number;
  account_id: number | null;
  date: string;
  description: string | null;
  amount: number;
  sender_name: string | null;
  hash: string;
  matched_shop_id: number | null;
  matched_invoice_id: number | null;
  created_at: string;
}

export interface SuggestedSubscription {
  id: number;
  sender_name: string | null;
  amount: number | null;
  billing_cycle: string | null;
  total_spent: number | null;
  transaction_count: number | null;
  status: 'pending_review' | 'confirmed' | 'dismissed';
  created_at: string;
}

export interface DetectedRecord {
  id: number;
  type: 'invoice' | 'subscription';
  email_subject: string | null;
  sender_name: string | null;
  sender_domain: string | null;
  amount: number | null;
  detected_date: string | null;
  status: 'pending' | 'confirmed' | 'dismissed';
  created_at: string;
}

export interface AppNotification {
  id: number;
  type: 'payment_due' | 'invoice_overdue' | 'automation_failed' | 'subscription_review';
  message: string;
  related_id: number | null;
  related_module: string | null;
  read: boolean;
  created_at: string;
}

export interface ActivityEvent {
  id: number;
  action: 'create' | 'update' | 'delete';
  module: string;
  record_id: number | null;
  record_name: string | null;
  details: string | null;
  created_at: string;
}

export interface ActivityDiff {
  field: string;
  old: string;
  new: string;
}

export interface DashboardStats {
  monthly_subscription_cost: number;
  active_subscriptions: number;
  open_invoices: number;
  active_projects: number;
}

export interface SearchResult {
  id: number;
  name: string;
  subtitle: string | null;
  module: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface Category {
  id: number;
  module: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ScratchNote {
  id: number;
  content: string;
  updated_at: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface ServerHealth {
  status: 'ok' | 'error';
  version: string;
  db_ok: boolean;
  missing_tables: string[];
  error?: string;
}
