// Meta-Werkzeug: beantwortet „Was kann dieser Server, woher kommen die Daten und was kann er nicht?“
import { COVERAGE, LIMITS } from '../coverage.mjs';
import { LICENSE_LIST } from '../sources.mjs';
import { MODERN_VERSION, SERVER_VERSION, SUPPORTED_VERSIONS } from '../protocol.mjs';
import { defineTool, enumStr, obj } from './shared.mjs';

export function createAboutTool({ tools, resources, prompts }) {
  return defineTool({
    name: 'about',
    title: 'Über diesen Server',
    description: 'Beschreibt den MCP-Server Open Stuttgart: verfügbare Werkzeuge, Ressourcen und Prompts, welche Daten live, zwischengespeichert, gemischt oder nur verlinkt sind, alle Quellen und Lizenzen sowie die Grenzen. Vor einer längeren Recherche aufrufen, um die richtigen Werkzeuge zu wählen.',
    sources: ['stuttgart'],
    cost: 1,
    annotations: { openWorldHint: false },
    inputSchema: obj({
      detail: enumStr('Umfang der Auskunft.', ['overview', 'tools', 'licenses', 'all'], { default: 'overview' }),
    }),
    async execute(a) {
      const detail = a.detail ?? 'overview';
      const overview = {
        name: 'Open Stuttgart',
        version: SERVER_VERSION,
        protocol: { modern: MODERN_VERSION, supported: SUPPORTED_VERSIONS, transports: ['Streamable HTTP', 'stdio'] },
        endpoints: { http: '/mcp', stdio: 'node server/mcp/stdio.mjs', health: '/healthz (standalone)' },
        counts: { tools: tools.length, resources: resources.length, prompts: prompts.length },
        coverage: COVERAGE,
        limits: LIMITS,
        attribution: 'Open Stuttgart, EUPL-1.2. Daten der Landeshauptstadt Stuttgart und Dritter; Quelle und Lizenz an jeder Antwort.',
        documentation: 'https://open-stuttgart.de/ (Repository: docs/mcp.md)',
      };
      if (detail === 'tools' || detail === 'all') {
        overview.tools = tools.map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          cost: t.cost,
          sources: t.sources,
        }));
      }
      if (detail === 'licenses' || detail === 'all') overview.licenses = LICENSE_LIST;
      if (detail === 'all') {
        overview.resources = resources.map((r) => ({ uri: r.uri, name: r.name, description: r.description }));
        overview.prompts = prompts.map((p) => ({ name: p.name, title: p.title, description: p.description }));
      }
      return { data: overview };
    },
  });
}
