/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseCloudId,
  resolveDeploymentId,
  enableFeatureFlagsViaCloud,
  type EnableFlagsViaCloudOptions,
} from '../src/cloud-feature-flags.js';

function mockJsonResponse(ok: boolean, data: unknown, status = ok ? 200 : 400) {
  const body = JSON.stringify(data);
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Bad Request',
    text: async () => body,
  };
}

const SAMPLE_DEPLOYMENT_ID = 'a051af502aa742ac8c87ffef895cb47b';

function sampleDeployment(userSettingsYaml = '') {
  return {
    name: 'My deployment',
    resources: {
      elasticsearch: [{
        ref_id: 'main-elasticsearch',
        region: 'gcp-us-west2',
        plan: {
          cluster_topology: [{ id: 'hot_content', size: { value: 2048, resource: 'memory' } }],
          elasticsearch: { version: '9.4.0-SNAPSHOT' },
        },
      }],
      kibana: [{
        ref_id: 'main-kibana',
        region: 'gcp-us-west2',
        elasticsearch_cluster_ref_id: 'main-elasticsearch',
        plan: {
          cluster_topology: [{ size: { value: 2048, resource: 'memory' } }],
          kibana: {
            version: '9.4.0-SNAPSHOT',
            user_settings_yaml: userSettingsYaml,
          },
        },
      }],
      integrations_server: [],
    },
  };
}

function sampleDeploymentList(domain = 'my-deploy.es.us-west2.gcp.elastic-cloud.com') {
  return {
    deployments: [{
      id: SAMPLE_DEPLOYMENT_ID,
      name: 'My deployment',
      resources: {
        elasticsearch: [{
          id: 'es-resource',
          info: { metadata: { endpoint: domain } },
        }],
        kibana: [{
          id: 'kb-resource',
          info: { metadata: { endpoint: `my-deploy.kb.us-west2.gcp.elastic-cloud.com` } },
        }],
      },
    }],
  };
}

describe('parseCloudId', () => {
  it('parses a valid Cloud ID', () => {
    const domain = 'my-deploy.us-west2.gcp.elastic-cloud.com';
    const esUuid = 'es-uuid-123';
    const kibanaUuid = 'kb-uuid-456';
    const encoded = Buffer.from(`${domain}:${esUuid}:${kibanaUuid}`).toString('base64');
    const cloudId = `my-deployment:${encoded}`;

    const result = parseCloudId(cloudId);
    expect(result).toEqual({ domain, esUuid, kibanaUuid });
  });

  it('returns null for invalid Cloud ID (no colon)', () => {
    expect(parseCloudId('nocolon')).toBeNull();
  });

  it('returns null when base64 decodes to fewer than 3 parts', () => {
    const encoded = Buffer.from('only-one-part').toString('base64');
    expect(parseCloudId(`name:${encoded}`)).toBeNull();
  });

  it('handles empty name before colon', () => {
    const encoded = Buffer.from('domain:es:kb').toString('base64');
    const result = parseCloudId(`:${encoded}`);
    expect(result).toEqual({ domain: 'domain', esUuid: 'es', kibanaUuid: 'kb' });
  });
});

describe('resolveDeploymentId', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ELASTIC_CLOUD_DEPLOYMENT_ID;
    delete process.env.ELASTIC_CLOUD_API_KEY;
    delete process.env.ES_CLOUD_ID;
    delete process.env.KIBANA_URL;
  });

  it('returns explicit deployment ID from env var', async () => {
    process.env.ELASTIC_CLOUD_DEPLOYMENT_ID = 'explicit-id-123';
    process.env.ELASTIC_CLOUD_API_KEY = 'test-key';
    const result = await resolveDeploymentId();
    expect(result).toBe('explicit-id-123');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('auto-discovers from ES_CLOUD_ID', async () => {
    const domain = 'my-deploy.us-west2.gcp.elastic-cloud.com';
    const encoded = Buffer.from(`${domain}:es-id:kb-id`).toString('base64');
    process.env.ES_CLOUD_ID = `my-deploy:${encoded}`;
    process.env.ELASTIC_CLOUD_API_KEY = 'test-key';

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse(true, sampleDeploymentList(domain))
    );

    const result = await resolveDeploymentId();
    expect(result).toBe(SAMPLE_DEPLOYMENT_ID);
  });

  it('auto-discovers from KIBANA_URL', async () => {
    process.env.KIBANA_URL = 'https://my-deploy.kb.us-west2.gcp.elastic-cloud.com:9243';
    process.env.ELASTIC_CLOUD_API_KEY = 'test-key';

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse(true, sampleDeploymentList())
    );

    const result = await resolveDeploymentId();
    expect(result).toBe(SAMPLE_DEPLOYMENT_ID);
  });

  it('returns null when no credentials or identifiers are set', async () => {
    const result = await resolveDeploymentId();
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when API returns no matching deployment', async () => {
    const encoded = Buffer.from('no-match.example.com:es:kb').toString('base64');
    process.env.ES_CLOUD_ID = `test:${encoded}`;
    process.env.ELASTIC_CLOUD_API_KEY = 'test-key';

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse(true, sampleDeploymentList('other-domain.elastic-cloud.com'))
    );

    const result = await resolveDeploymentId();
    expect(result).toBeNull();
  });
});

describe('enableFeatureFlagsViaCloud', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const fastOpts: EnableFlagsViaCloudOptions = { maxWaitMs: 200, pollIntervalMs: 50 };

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    process.env.ELASTIC_CLOUD_API_KEY = 'test-cloud-key';
    process.env.ELASTIC_CLOUD_DEPLOYMENT_ID = SAMPLE_DEPLOYMENT_ID;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ELASTIC_CLOUD_API_KEY;
    delete process.env.ELASTIC_CLOUD_DEPLOYMENT_ID;
    delete process.env.ES_CLOUD_ID;
    delete process.env.KIBANA_URL;
  });

  it('returns early when deployment ID cannot be resolved', async () => {
    delete process.env.ELASTIC_CLOUD_DEPLOYMENT_ID;
    const notes = await enableFeatureFlagsViaCloud(fastOpts);
    expect(notes[0]).toContain('Could not resolve Cloud deployment ID');
  });

  it('skips update when all flags are already present', async () => {
    const yaml = [
      'server.restrictInternalApis: false',
      'feature_flags.overrides.dashboardAgent.enabled: true',
      'feature_flags.overrides.lens.apiFormat: true',
      'feature_flags.overrides.lens.enable_esql: true',
    ].join('\n');

    fetchMock.mockResolvedValueOnce(
      mockJsonResponse(true, sampleDeployment(yaml))
    );

    const notes = await enableFeatureFlagsViaCloud(fastOpts);
    expect(notes[0]).toContain('already present');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('updates deployment when flags are missing', async () => {
    const existingYaml = 'xpack.security.enabled: true';

    fetchMock
      .mockResolvedValueOnce(mockJsonResponse(true, sampleDeployment(existingYaml)))
      .mockResolvedValueOnce(mockJsonResponse(true, { id: SAMPLE_DEPLOYMENT_ID }))
      .mockResolvedValueOnce(
        mockJsonResponse(true, {
          resources: { kibana: [{ info: { plan_info: {} } }] },
        })
      );

    const notes = await enableFeatureFlagsViaCloud(fastOpts);
    expect(notes[0]).toContain('Updated Cloud Kibana user settings');
    expect(notes[0]).toContain('server.restrictInternalApis');

    const putCall = fetchMock.mock.calls[1];
    expect(putCall[0]).toContain(`/api/v1/deployments/${SAMPLE_DEPLOYMENT_ID}`);
    expect(putCall[0]).toContain('skip_snapshot=true');
    expect(putCall[1].method).toBe('PUT');

    const putBody = JSON.parse(putCall[1].body);
    expect(putBody.prune_orphans).toBe(false);
    const updatedYaml = putBody.resources.kibana[0].plan.kibana.user_settings_yaml;
    expect(updatedYaml).toContain('xpack.security.enabled: true');
    expect(updatedYaml).toContain('server.restrictInternalApis: false');
    expect(updatedYaml).toContain('feature_flags.overrides.dashboardAgent.enabled: true');
    expect(updatedYaml).toContain('feature_flags.overrides.lens.apiFormat: true');
    expect(updatedYaml).toContain('feature_flags.overrides.lens.enable_esql: true');
  });

  it('appends only missing flags', async () => {
    const existingYaml = [
      'server.restrictInternalApis: false',
      'feature_flags.overrides.lens.apiFormat: true',
    ].join('\n');

    fetchMock
      .mockResolvedValueOnce(mockJsonResponse(true, sampleDeployment(existingYaml)))
      .mockResolvedValueOnce(mockJsonResponse(true, { id: SAMPLE_DEPLOYMENT_ID }))
      .mockResolvedValueOnce(
        mockJsonResponse(true, {
          resources: { kibana: [{ info: { plan_info: {} } }] },
        })
      );

    const notes = await enableFeatureFlagsViaCloud(fastOpts);
    expect(notes[0]).toContain('dashboardAgent.enabled');
    expect(notes[0]).toContain('lens.enable_esql');
    expect(notes[0]).not.toContain('server.restrictInternalApis');
    expect(notes[0]).not.toContain('lens.apiFormat');
  });

  it('reports error when GET deployment fails', async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse(false, { message: 'Forbidden' }, 403)
    );

    const notes = await enableFeatureFlagsViaCloud(fastOpts);
    expect(notes[0]).toContain('Failed to get Cloud deployment');
  });

  it('reports error when PUT deployment fails', async () => {
    fetchMock
      .mockResolvedValueOnce(mockJsonResponse(true, sampleDeployment('')))
      .mockResolvedValueOnce(mockJsonResponse(false, { message: 'Validation error' }, 400));

    const notes = await enableFeatureFlagsViaCloud(fastOpts);
    expect(notes[0]).toContain('Failed to update Cloud deployment');
  });

  it('handles no Kibana resource in deployment', async () => {
    const deployment = sampleDeployment();
    deployment.resources.kibana = [];

    fetchMock.mockResolvedValueOnce(mockJsonResponse(true, deployment));

    const notes = await enableFeatureFlagsViaCloud(fastOpts);
    expect(notes[0]).toContain('No Kibana resource found');
  });

  it('reports pending plan when wait times out', async () => {
    fetchMock
      .mockResolvedValueOnce(mockJsonResponse(true, sampleDeployment('')))
      .mockResolvedValueOnce(mockJsonResponse(true, { id: SAMPLE_DEPLOYMENT_ID }));

    const pendingResponse = mockJsonResponse(true, {
      resources: { kibana: [{ info: { plan_info: { pending: { some: 'plan' } } } }] },
    });
    for (let i = 0; i < 20; i++) {
      fetchMock.mockResolvedValueOnce(pendingResponse);
    }

    const notes = await enableFeatureFlagsViaCloud(fastOpts);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain('Updated Cloud Kibana');
    expect(notes[1]).toContain('still pending');
  });
});
