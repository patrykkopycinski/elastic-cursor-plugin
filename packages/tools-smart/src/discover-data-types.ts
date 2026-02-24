/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export interface ClusterProfile {
  cluster_info: GenericClusterInfo;
  indices: IndexInfo[];
  templates: TemplateInfo[];
  component_templates: ComponentTemplateInfo[];
  pipelines: PipelineInfo[];
  lifecycle_policies: LifecyclePolicy[];
  discovery_time_ms: number;
}

export interface GenericClusterInfo {
  name: string;
  uuid: string;
  version: string;
  is_serverless: boolean;
}

export interface IndexInfo {
  name: string;
  type: 'logs' | 'metrics' | 'traces' | 'synthetics' | 'other';
  is_data_stream: boolean;
  doc_count: number;
  time_range: { from: string; to: string };
  freshness: { last_document: string; status: 'active' | 'stale' | 'no_data' };
  key_fields: FieldInfo[];
}

export interface FieldInfo {
  name: string;
  type: string;
  is_ecs: boolean;
}

export interface TemplateInfo {
  name: string;
  index_patterns: string[];
  is_managed: boolean;
  priority: number;
  composed_of: string[];
}

export interface ComponentTemplateInfo {
  name: string;
  is_managed: boolean;
}

export interface PipelineInfo {
  name: string;
  description: string;
  processor_count: number;
}

export interface LifecyclePolicy {
  name: string;
  phases: string[];
  managed: boolean;
}
