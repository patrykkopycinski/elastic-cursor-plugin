/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { z } from 'zod';
import type { ToolRegistrationContext } from './types.js';

const FRAMEWORKS = ['express', 'fastify', 'koa', 'nestjs', 'python-django', 'python-flask', 'python-fastapi', 'java-spring', 'go', 'dotnet'] as const;

export function registerSetupApm(server: ToolRegistrationContext): void {
  server.registerTool(
    'setup_apm',
    {
      title: 'Setup APM',
      description:
        'Generate APM integration code for Node.js (Express, Fastify, Koa, NestJS), Python (Django, Flask, FastAPI), Java (Spring Boot), Go, or .NET.',
      inputSchema: z.object({
        framework: z.enum(FRAMEWORKS).describe('Target framework'),
        server_url: z.string().url().optional().describe('APM Server URL (e.g. https://xxx.apm.region.elastic-cloud.com)'),
        secret_token: z.string().optional().describe('Secret token for APM Server'),
        service_name: z.string().optional().describe('Service name'),
      }),
    },
    async (args) => {
      const { framework, server_url, secret_token, service_name } = args as {
        framework: (typeof FRAMEWORKS)[number];
        server_url?: string;
        secret_token?: string;
        service_name?: string;
      };
      const url = server_url || process.env.ELASTIC_APM_SERVER_URL || 'http://localhost:8200';
      const token = secret_token || process.env.ELASTIC_APM_SECRET_TOKEN || '';
      const svc = service_name || 'my-service';

      const snippets: Record<string, string> = {
        express: `const apm = require('elastic-apm-node').start({
  serviceName: '${svc}',
  serverUrl: '${url}',
  secretToken: '${token}'
});
const express = require('express');
const app = express();
// ... your routes
app.listen(3000);`,
        fastify: `const apm = require('elastic-apm-node').start({
  serviceName: '${svc}',
  serverUrl: '${url}',
  secretToken: '${token}'
});
const fastify = require('fastify')();
// ... your routes
fastify.listen(3000);`,
        koa: `const apm = require('elastic-apm-node').start({
  serviceName: '${svc}',
  serverUrl: '${url}',
  secretToken: '${token}'
});
const Koa = require('koa');
const app = new Koa();
// ... your middleware
app.listen(3000);`,
        nestjs: `// main.ts - ensure apm is first
import apm from 'elastic-apm-node';
apm.start({ serviceName: '${svc}', serverUrl: '${url}', secretToken: '${token}' });
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();`,
        'python-django': `# settings.py
INSTALLED_APPS += ['elasticapm.contrib.django']
ELASTIC_APM = {
    'SERVICE_NAME': '${svc}',
    'SERVER_URL': '${url}',
    'SECRET_TOKEN': '${token}',
}
MIDDLEWARE = ['elasticapm.contrib.django.middleware.TracingMiddleware'] + MIDDLEWARE`,
        'python-flask': `from elasticapm import ElasticAPM
from flask import Flask
app = Flask(__name__)
app.config['ELASTIC_APM'] = {
    'SERVICE_NAME': '${svc}',
    'SERVER_URL': '${url}',
    'SECRET_TOKEN': '${token}',
}
apm = ElasticAPM(app)`,
        'python-fastapi': `from elasticapm.contrib.starlette import make_apm_client, ElasticAPM
apm_config = {'SERVICE_NAME': '${svc}', 'SERVER_URL': '${url}', 'SECRET_TOKEN': '${token}'}
apm = make_apm_client(apm_config)
from fastapi import FastAPI
app = FastAPI()
app.add_middleware(ElasticAPM, **apm_config)`,
        'java-spring': `# application.properties
elastic.apm.service_name=${svc}
elastic.apm.server_urls=${url}
elastic.apm.secret_token=${token}
# Run with: -javaagent:/path/to/elastic-apm-agent.jar`,
        go: `import "go.elastic.co/apm/v2"
apm.DefaultTracer().SetLogger(apm.DefaultLogger(os.Stderr))
// In main: start tracer with ELASTIC_APM_SERVER_URL and ELASTIC_APM_SECRET_TOKEN env vars
// Use apm.StartTransaction, apm.StartSpan in handlers`,
        dotnet: `// Use Elastic.Apm.NetCoreAll package; in Main:
Elastic.Apm.Agent.AddMiddleware(app);
// Configure with env: ELASTIC_APM_SERVER_URL, ELASTIC_APM_SECRET_TOKEN, ELASTIC_APM_SERVICE_NAME`,
      };
      const text = snippets[framework] ?? `Framework ${framework} not found. Supported: ${FRAMEWORKS.join(', ')}`;
      return { content: [{ type: 'text', text }] };
    }
  );
}
