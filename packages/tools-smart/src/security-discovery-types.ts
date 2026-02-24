/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export interface SecurityDiscoveryResult {
  cluster_info: { name: string; version: string; uuid: string };
  data_sources: SecurityDataSource[];
  rule_coverage: RuleCoverage | null;
  alert_summary: AlertSummary | null;
  discovery_time_ms: number;
}

export interface SecurityDataSource {
  name: string;
  category: 'endpoint' | 'audit' | 'windows' | 'network' | 'cloud' | 'alerts' | 'other';
  index_pattern: string;
  doc_count: number;
  time_range: { from: string; to: string };
  freshness: { last_document: string; status: 'active' | 'stale' | 'no_data' };
}

export interface RuleCoverage {
  total: number;
  enabled: number;
  disabled: number;
  by_type: Record<string, number>;
  by_severity: Record<string, number>;
  mitre_techniques: string[];
  mitre_tactics: string[];
  rules_with_exceptions: number;
}

export interface AlertSummary {
  total_open: number;
  by_severity: Record<string, number>;
  top_rules: Array<{ name: string; count: number }>;
}

export const SECURITY_INDEX_PATTERNS: Array<{
  pattern: string;
  category: SecurityDataSource['category'];
  label: string;
}> = [
  { pattern: 'logs-endpoint*', category: 'endpoint', label: 'Elastic Defend / Endpoint' },
  { pattern: 'metrics-endpoint*', category: 'endpoint', label: 'Endpoint Metrics' },
  { pattern: 'auditbeat-*', category: 'audit', label: 'Auditbeat' },
  { pattern: 'winlogbeat-*', category: 'windows', label: 'Winlogbeat' },
  { pattern: 'logs-windows*', category: 'windows', label: 'Windows Logs' },
  { pattern: 'packetbeat-*', category: 'network', label: 'Packetbeat' },
  { pattern: 'logs-network_traffic*', category: 'network', label: 'Network Traffic' },
  { pattern: 'logs-cloud_security*', category: 'cloud', label: 'Cloud Security' },
  { pattern: 'logs-aws.cloudtrail*', category: 'cloud', label: 'AWS CloudTrail' },
  { pattern: 'logs-aws.guardduty*', category: 'cloud', label: 'AWS GuardDuty' },
  { pattern: 'logs-gcp.audit*', category: 'cloud', label: 'GCP Audit' },
  { pattern: 'logs-azure.activitylogs*', category: 'cloud', label: 'Azure Activity Logs' },
  { pattern: '.alerts-security*', category: 'alerts', label: 'Security Alerts' },
];

export const MITRE_TACTICS = [
  'Reconnaissance',
  'Resource Development',
  'Initial Access',
  'Execution',
  'Persistence',
  'Privilege Escalation',
  'Defense Evasion',
  'Credential Access',
  'Discovery',
  'Lateral Movement',
  'Collection',
  'Command and Control',
  'Exfiltration',
  'Impact',
] as const;
