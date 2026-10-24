// Der komplette Katalog: Werkzeuge, Ressourcen und Prompts an einer Stelle.
import { searchTools } from './tools/search.mjs';
import { mobilityTools } from './tools/mobility.mjs';
import { adminTools } from './tools/admin.mjs';
import { cultureTools } from './tools/culture.mjs';
import { environmentTools } from './tools/environment.mjs';
import { openDataTools } from './tools/opendata.mjs';
import { laborTools } from './tools/labor.mjs';
import { createAboutTool } from './tools/meta.mjs';
import { createResources } from './resources.mjs';
import { prompts } from './prompts.mjs';

const baseTools = [
  ...searchTools,
  ...mobilityTools,
  ...adminTools,
  ...cultureTools,
  ...environmentTools,
  ...openDataTools,
  ...laborTools,
];

const tools = [...baseTools];
const { resources, resourceTemplates, read } = createResources({ tools, prompts });
const about = createAboutTool({ tools, resources, prompts });
tools.unshift(about);

const toolByName = new Map(tools.map((t) => [t.name, t]));
if (toolByName.size !== tools.length) throw new Error('Doppelte Werkzeugnamen im MCP-Katalog');

export const CATALOG = {
  tools,
  toolByName,
  resources,
  resourceTemplates,
  prompts,
  readResource: read,
  counts: { tools: tools.length, resources: resources.length, prompts: prompts.length },
};
