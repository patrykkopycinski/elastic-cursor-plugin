/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { z } from 'zod';
import type { ToolRegistrationContext } from '@elastic-cursor-plugin/shared-types';
import { textResponse } from '@elastic-cursor-plugin/shared-types';
import type {
  SecurityDiscoveryResult,
  RuleCoverage,
  AlertSummary,
} from './security-discovery-types.js';
import { MITRE_TACTICS } from './security-discovery-types.js';

function assessOverallHealth(result: SecurityDiscoveryResult): string {
  const activeSources = result.data_sources.filter((ds) => ds.freshness.status === 'active').length;
  const totalSources = result.data_sources.length;
  if (totalSources === 0) return 'No Data';
  if (activeSources === totalSources) return 'Good';
  if (activeSources >= totalSources * 0.5) return 'Moderate';
  return 'Degraded';
}

function computeCoveragePercentage(result: SecurityDiscoveryResult): number {
  if (!result.rule_coverage || result.data_sources.length === 0) return 0;
  const categories = new Set(result.data_sources.map((ds) => ds.category));
  const categoryRulePatterns: Record<string, string[]> = {
    endpoint: ['endpoint', 'edr', 'malware', 'ransomware', 'process', 'file'],
    audit: ['audit', 'authentication', 'sudo', 'ssh'],
    windows: ['windows', 'powershell', 'registry', 'sysmon', 'wmi'],
    network: ['network', 'dns', 'http', 'tls', 'firewall'],
    cloud: ['cloud', 'aws', 'gcp', 'azure', 'iam', 's3'],
  };

  let coveredCategories = 0;
  for (const cat of categories) {
    if (cat === 'alerts') continue;
    const patterns = categoryRulePatterns[cat];
    if (!patterns) continue;
    coveredCategories++;
  }

  const relevantCategories = Array.from(categories).filter((c) => c !== 'alerts').length;
  if (relevantCategories === 0) return 0;

  const enabledRatio = result.rule_coverage.enabled / Math.max(result.rule_coverage.total, 1);
  return Math.round((coveredCategories / relevantCategories) * enabledRatio * 100);
}

function identifyGaps(result: SecurityDiscoveryResult): string[] {
  const gaps: string[] = [];
  const categories = new Set(result.data_sources.map((ds) => ds.category));

  if (categories.has('endpoint') && result.rule_coverage) {
    const hasEndpointRules = result.rule_coverage.by_type['eql'] ?? 0;
    if (hasEndpointRules === 0) {
      gaps.push('Endpoint data detected but no EQL-based detection rules are enabled — consider enabling prebuilt Endpoint rules.');
    }
  }

  if (categories.has('cloud') && result.rule_coverage) {
    const cloudTactics = result.rule_coverage.mitre_tactics.filter((t) =>
      t.toLowerCase().includes('initial access') || t.toLowerCase().includes('persistence')
    );
    if (cloudTactics.length === 0) {
      gaps.push('Cloud security data detected but no rules covering Initial Access or Persistence tactics — consider enabling cloud detection rules.');
    }
  }

  if (categories.has('network') && result.rule_coverage) {
    const hasNetworkRules = result.rule_coverage.by_type['threshold'] ?? 0;
    if (hasNetworkRules === 0) {
      gaps.push('Network data detected but no threshold-based rules — consider enabling network anomaly detection rules.');
    }
  }

  if (!categories.has('endpoint')) {
    gaps.push('No endpoint data sources detected — deploy Elastic Defend for host-level visibility.');
  }
  if (!categories.has('cloud') && !categories.has('network')) {
    gaps.push('No cloud or network data — consider adding cloud provider log integrations or Packetbeat.');
  }

  const staleSources = result.data_sources.filter((ds) => ds.freshness.status === 'stale');
  for (const ds of staleSources) {
    gaps.push(`${ds.name} data is stale (last document: ${ds.freshness.last_document}) — check agent/integration health.`);
  }

  return gaps;
}

function formatMitreCoverage(coverage: RuleCoverage): string[] {
  const lines: string[] = [];
  lines.push('## MITRE ATT&CK Coverage');
  lines.push('');

  const coveredTactics = new Set(coverage.mitre_tactics.map((t) => t.toLowerCase()));
  for (const tactic of MITRE_TACTICS) {
    const covered = coveredTactics.has(tactic.toLowerCase());
    lines.push(`- ${covered ? '✅' : '❌'} **${tactic}**`);
  }

  const coveredCount = MITRE_TACTICS.filter((t) => coveredTactics.has(t.toLowerCase())).length;
  lines.push('');
  lines.push(`Coverage: ${coveredCount}/${MITRE_TACTICS.length} tactics`);

  return lines;
}

function formatAlertTrend(alerts: AlertSummary): string {
  if (alerts.total_open > 100) return '⬆️ High volume';
  if (alerts.total_open > 20) return '➡️ Moderate';
  if (alerts.total_open > 0) return '⬇️ Low';
  return '✅ Clean';
}

function generateRecommendations(result: SecurityDiscoveryResult): string[] {
  const recs: string[] = [];

  if (!result.rule_coverage) {
    recs.push('Configure Kibana URL to enable detection rule analysis.');
    return recs;
  }

  if (result.rule_coverage.disabled > 0) {
    const highSeverityDisabled = Object.entries(result.rule_coverage.by_severity)
      .filter(([k]) => k === 'critical' || k === 'high')
      .reduce((sum, [, v]) => sum + v, 0);
    if (highSeverityDisabled > 0) {
      recs.push(`Enable high-severity disabled rules — ${result.rule_coverage.disabled} rules are disabled.`);
    }
  }

  if (result.rule_coverage.mitre_tactics.length < 8) {
    recs.push(`Expand MITRE coverage — only ${result.rule_coverage.mitre_tactics.length}/14 tactics covered. Enable prebuilt rules for missing tactics.`);
  }

  if (result.data_sources.length > 0 && result.rule_coverage.enabled === 0) {
    recs.push('No detection rules are enabled — use `siem_quickstart` to configure initial detection coverage.');
  }

  if (result.alert_summary && result.alert_summary.total_open > 50) {
    recs.push(`${result.alert_summary.total_open} open alerts — consider triaging and closing resolved alerts.`);
  }

  if (recs.length === 0) {
    recs.push('Security posture looks healthy. Continue monitoring for new data sources and rule updates.');
  }

  return recs;
}

function formatSummaryMarkdown(result: SecurityDiscoveryResult, sections?: string[]): string {
  const lines: string[] = [];
  const showAll = !sections || sections.length === 0;

  lines.push('# Security Posture Summary');
  lines.push('');

  const health = assessOverallHealth(result);
  const coveragePct = computeCoveragePercentage(result);
  lines.push(`**Overall Health:** ${health}`);
  lines.push(`**Detection Coverage:** ~${coveragePct}%`);
  lines.push(`**Active Data Sources:** ${result.data_sources.filter((ds) => ds.freshness.status === 'active').length}/${result.data_sources.length}`);
  if (result.alert_summary) {
    lines.push(`**Alert Trend:** ${formatAlertTrend(result.alert_summary)}`);
  }

  if (showAll || sections?.includes('gaps')) {
    const gaps = identifyGaps(result);
    lines.push('');
    lines.push('## Coverage Gaps');
    if (gaps.length > 0) {
      for (const gap of gaps) lines.push(`- ${gap}`);
    } else {
      lines.push('No significant coverage gaps identified.');
    }
  }

  if ((showAll || sections?.includes('mitre')) && result.rule_coverage) {
    lines.push('');
    lines.push(...formatMitreCoverage(result.rule_coverage));
  }

  if (showAll || sections?.includes('recommendations')) {
    const recs = generateRecommendations(result);
    lines.push('');
    lines.push('## Recommended Actions');
    for (const rec of recs) lines.push(`- ${rec}`);
  }

  return lines.join('\n');
}

export function registerGetSecuritySummary(server: ToolRegistrationContext): void {
  server.registerTool(
    'get_security_summary',
    {
      title: 'Get Security Summary',
      description:
        'Generate a security posture summary with coverage gaps, MITRE ATT&CK matrix, alert trends, and recommended actions. Uses discover_security_data results (live or cached).',
      inputSchema: z.object({
        sections: z
          .array(z.string())
          .optional()
          .describe('Sections to include: gaps, mitre, recommendations. Defaults to all.'),
        discovery_data: z
          .unknown()
          .optional()
          .describe('Pre-computed SecurityDiscoveryResult to summarize (avoids re-running discovery)'),
      }),
    },
    async (args: unknown) => {
      const input = args as {
        sections?: string[];
        discovery_data?: SecurityDiscoveryResult;
      };

      if (input.discovery_data) {
        return textResponse(formatSummaryMarkdown(input.discovery_data, input.sections));
      }

      return textResponse(
        'No discovery data provided. Run `discover_security_data` first, then pass the result as `discovery_data`, or use `get_cluster_context` for cached results.'
      );
    }
  );
}
