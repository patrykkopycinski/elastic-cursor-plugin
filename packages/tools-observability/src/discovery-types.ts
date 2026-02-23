/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export interface DiscoveryResult {
  cluster_info: ClusterInfo;
  services: ApmService[];
  hosts: HostInfo[];
  containers: ContainerInfo[];
  log_sources: LogSource[];
  data_streams: DataStreamInfo[];
  iot_profiles: IoTProfile[];
  discovery_time_ms: number;
}

export interface ClusterInfo {
  name: string;
  version: string;
  is_serverless: boolean;
}

export interface ApmService {
  name: string;
  environment: string;
  language: string;
  throughput_per_min: number;
  time_range: TimeRange;
  freshness: DataFreshness;
  data_streams: string[];
}

export interface HostInfo {
  name: string;
  metric_types: string[];
  collection_interval_seconds: number | null;
  time_range: TimeRange;
  freshness: DataFreshness;
}

export interface ContainerInfo {
  id: string;
  name: string | null;
  pod_name: string | null;
  namespace: string | null;
  node_name: string | null;
  metric_families: string[];
  time_range: TimeRange;
  freshness: DataFreshness;
}

export interface LogSource {
  dataset: string;
  service_name: string | null;
  host_name: string | null;
  estimated_docs_per_day: number;
  is_structured: boolean;
  field_count: number;
  time_range: TimeRange;
  freshness: DataFreshness;
  log_level_distribution: Record<string, number> | null;
}

export interface DataStreamInfo {
  name: string;
  type: 'traces' | 'metrics' | 'logs' | 'other';
  doc_count: number;
  time_range: TimeRange;
  freshness: DataFreshness;
  key_fields: FieldProfile[];
}

export interface FieldProfile {
  name: string;
  type: string;
  cardinality: number;
  sample_values: string[];
}

export interface TimeRange {
  from: string;
  to: string;
}

export interface DataFreshness {
  last_document: string;
  status: 'active' | 'stale' | 'no_data';
}

export interface IoTMetricFamily {
  name: string;
  fields: string[];
  doc_count: number;
}

export interface IoTDevice {
  site: string;
  device_type: string;
  metric_families: IoTMetricFamily[];
  doc_count: number;
}

export interface IoTProfile {
  data_stream: string;
  sites: string[];
  device_types: string[];
  devices: IoTDevice[];
  metric_fields: string[];
  attribute_fields: string[];
  total_docs: number;
  time_range: TimeRange;
  freshness: DataFreshness;
}

export interface DiscoveryOptions {
  data_streams?: string[];
  service_names?: string[];
  time_range?: { from: string; to: string };
  max_indices?: number;
}
