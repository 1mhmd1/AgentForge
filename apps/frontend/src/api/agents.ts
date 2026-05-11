import { client, unwrap } from './client';
import type { Domain, RunSummary } from './runs';

export interface AgentCatalogEntry {
  id: string;
  name: string;
  domain: Domain;
  icon: 'GlobeIcon' | 'TransformIcon' | 'DocIcon' | 'LayoutIcon';
  accent: string;
  tag: string;
  desc: string;
  emoji: string;
}

/**
 * Static catalog of agents the UI exposes. The backend doesn't currently
 * expose a "list of agent kinds" endpoint — `GET /api/agents` lists the
 * caller's RUNS filtered by domain. So the catalog (4 fixed domains baked
 * into the Python AI service) lives client-side and maps directly to the
 * Domain enum the backend's CreateRunDto validates.
 */
export const AGENT_CATALOG: AgentCatalogEntry[] = [
  {
    id: 'web',
    name: 'Web Research',
    domain: 'web_research',
    icon: 'GlobeIcon',
    accent: '#06B6D4',
    tag: 'Research',
    desc: 'Autonomously browses the web, extracts data, and synthesizes research reports in seconds.',
    emoji: '⚡',
  },
  {
    id: 'data',
    name: 'Data Transform',
    domain: 'data_transform',
    icon: 'TransformIcon',
    accent: '#7C3AED',
    tag: 'Processing',
    desc: 'Ingests raw datasets in any format and outputs clean, structured, analysis-ready data.',
    emoji: '🔄',
  },
  {
    id: 'doc',
    name: 'Document Generator',
    domain: 'document',
    icon: 'DocIcon',
    accent: '#3B82F6',
    tag: 'Generation',
    desc: 'Generates professional documents, reports, and contracts from your specifications.',
    emoji: '📄',
  },
  {
    id: 'site',
    name: 'Website Builder',
    domain: 'website_builder',
    icon: 'LayoutIcon',
    accent: '#F59E0B',
    tag: 'Builder',
    desc: 'Designs and codes full landing pages, dashboards, and apps from a single prompt.',
    emoji: '🌐',
  },
];

export function agentByDomain(domain: Domain): AgentCatalogEntry {
  return AGENT_CATALOG.find((a) => a.domain === domain) ?? AGENT_CATALOG[0];
}

export interface PagedAgentRuns {
  items: RunSummary[];
  page: number;
  perPage: number;
  total: number;
}

export async function listAgentRuns(params: {
  domain?: Domain;
  status?: string;
  page?: number;
  perPage?: number;
} = {}): Promise<PagedAgentRuns> {
  return unwrap<PagedAgentRuns>(client.get('/agents', { params }));
}
