export interface Env {
  TRILIUM_BASE_URL: string;
  TRILIUM_ETAPI_TOKEN: string;
  ROOT_NOTE_ID?: string;
  ALLOW_ORIGIN?: string;
  CACHE_MAX_AGE?: string;
  MAP_MAX_NODES?: string;
}

interface TriliumAttribute {
  attributeId?: string;
  noteId?: string;
  type?: string;
  name?: string;
  value?: string;
}

interface TriliumNote {
  noteId: string;
  title?: string;
  type?: string;
  mime?: string;
  childNoteIds?: string[];
  childBranchIds?: string[];
  parentNoteIds?: string[];
  parentBranchIds?: string[];
  attributes?: TriliumAttribute[];
  dateCreated?: string;
  dateModified?: string;
}

interface TriliumBranch {
  branchId: string;
  noteId: string;
  parentNoteId: string;
  prefix?: string;
  notePosition?: number;
  isExpanded?: boolean;
  utcDateModified?: string;
}

interface LazyTreeNode {
  noteId: string;
  title: string;
  type: string;
  mime?: string;
  path: string;
  href: string;
  prefix?: string;
  childCount: number;
  hasChildren: boolean;
  loaded?: boolean;
  children?: LazyTreeNode[];
  dateCreated?: string;
  dateModified?: string;
}

interface DebugInfo {
  rootType?: string;
  rootTitle?: string;
  childBranchCount?: number;
  childNoteCount?: number;
  branchFetches?: number;
  noteFetches?: number;
  childResolveFailures?: Array<{ noteId?: string; branchId?: string; error: string }>;
}

interface NoteMapNodeTuple extends Array<string | null> {
  0: string;
  1: string;
  2: string;
  3: string | null;
}

interface NoteMapLink {
  id: string;
  sourceNoteId: string;
  targetNoteId: string;
  name: string;
}

const json = (data: unknown, init: ResponseInit = {}, env?: Env) => {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('access-control-allow-origin', env?.ALLOW_ORIGIN || '*');
  headers.set('access-control-allow-methods', 'GET,OPTIONS');
  headers.set('access-control-allow-headers', 'Content-Type, Authorization');
  headers.set('cache-control', `public, max-age=${Number(env?.CACHE_MAX_AGE || '300')}`);
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
};

const trimSlash = (value: string) => value.replace(/\/$/, '');
const makeHref = (baseUrl: string, noteId: string) => `${trimSlash(baseUrl)}/#root/${noteId}`;

async function triliumFetch<T>(env: Env, path: string): Promise<T> {
  const url = `${trimSlash(env.TRILIUM_BASE_URL)}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: env.TRILIUM_ETAPI_TOKEN,
      Accept: 'application/json',
    },
    cf: {
      cacheTtl: Number(env.CACHE_MAX_AGE || '300'),
      cacheEverything: false,
    },
  });

  if (!res.ok) {
    throw new Error(`Trilium request failed: ${res.status} ${res.statusText} @ ${path}`);
  }

  return (await res.json()) as T;
}

async function getNote(env: Env, noteId: string, noteCache: Map<string, TriliumNote>, debugInfo: DebugInfo): Promise<TriliumNote> {
  const cached = noteCache.get(noteId);
  if (cached) return cached;
  debugInfo.noteFetches = (debugInfo.noteFetches || 0) + 1;
  const note = await triliumFetch<TriliumNote>(env, `/etapi/notes/${encodeURIComponent(noteId)}`);
  noteCache.set(noteId, note);
  return note;
}

async function getBranch(env: Env, branchId: string, branchCache: Map<string, TriliumBranch>, debugInfo: DebugInfo): Promise<TriliumBranch> {
  const cached = branchCache.get(branchId);
  if (cached) return cached;
  debugInfo.branchFetches = (debugInfo.branchFetches || 0) + 1;
  const branch = await triliumFetch<TriliumBranch>(env, `/etapi/branches/${encodeURIComponent(branchId)}`);
  branchCache.set(branchId, branch);
  return branch;
}

function shouldExcludeFromTree(note: TriliumNote): boolean {
  return (note.attributes || []).some((attr) => attr.type === 'label' && attr.name === 'excludeFromNoteMap');
}

function isSystemHiddenNote(note: TriliumNote): boolean {
  return note.noteId.startsWith('_');
}

function shouldExcludeVisibleNote(note: TriliumNote, rootId?: string): boolean {
  if (note.noteId === rootId) return false;
  if (shouldExcludeFromTree(note)) return true;
  if (isSystemHiddenNote(note)) return true;
  return false;
}

function getColorLabel(note: TriliumNote): string | null {
  const label = (note.attributes || []).find((attr) => attr.type === 'label' && attr.name === 'color');
  return label?.value || null;
}

function isImageLinkRelation(attr: TriliumAttribute): boolean {
  return attr.type === 'relation' && attr.name === 'imageLink' && !!attr.value;
}

async function buildDescendantCountMap(
  env: Env,
  noteIdsToCount: string[],
  noteCache: Map<string, TriliumNote>,
  debugInfo: DebugInfo,
): Promise<Record<string, number>> {
  const countMap: Record<string, number> = Object.create(null);

  async function getCount(noteId: string): Promise<number> {
    if (noteId in countMap) return countMap[noteId];

    const note = await getNote(env, noteId, noteCache, debugInfo);
    const hiddenImageNoteIds = (note.attributes || []).filter(isImageLinkRelation).map((attr) => String(attr.value));
    const childNoteIds = Array.isArray(note.childNoteIds) ? note.childNoteIds : [];
    const nonHiddenNoteIds = childNoteIds.filter((childId) => !hiddenImageNoteIds.includes(childId));

    let total = nonHiddenNoteIds.length;
    for (const childId of childNoteIds) {
      total += await getCount(childId);
    }

    countMap[noteId] = total;
    return total;
  }

  for (const noteId of noteIdsToCount) {
    await getCount(noteId);
  }

  return countMap;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker());
  await Promise.all(workers);
  return results;
}

function pushDebugFailure(debugInfo: DebugInfo, payload: { noteId?: string; branchId?: string; error: string }) {
  if (!debugInfo.childResolveFailures) {
    debugInfo.childResolveFailures = [];
  }
  if (debugInfo.childResolveFailures.length < 20) {
    debugInfo.childResolveFailures.push(payload);
  }
}

async function resolveChildrenOneLevel(
  env: Env,
  note: TriliumNote,
  currentPath: string,
  branchCache: Map<string, TriliumBranch>,
  noteCache: Map<string, TriliumNote>,
  debugInfo: DebugInfo,
): Promise<LazyTreeNode[]> {
  const pathBase = currentPath || `/${note.title || note.noteId}`;
  const childBranchIds = Array.isArray(note.childBranchIds) ? note.childBranchIds : [];
  const childNoteIds = Array.isArray(note.childNoteIds) ? note.childNoteIds : [];

  let refs: Array<{ noteId: string; branchId?: string; prefix?: string; notePosition?: number }> = [];

  if (childBranchIds.length) {
    const branches = await mapWithConcurrency(childBranchIds, 8, async (branchId) => getBranch(env, branchId, branchCache, debugInfo));
    refs = branches.map((branch) => ({
      noteId: branch.noteId,
      branchId: branch.branchId,
      prefix: branch.prefix,
      notePosition: branch.notePosition ?? 0,
    }));
  } else {
    refs = childNoteIds.map((noteId, idx) => ({ noteId, notePosition: idx }));
  }

  refs.sort((a, b) => (a.notePosition ?? 0) - (b.notePosition ?? 0));

  const resolved: Array<LazyTreeNode | null> = await mapWithConcurrency(refs, 8, async (ref) => {
    try {
      const childNote = await getNote(env, ref.noteId, noteCache, debugInfo);
      if (shouldExcludeVisibleNote(childNote, note.noteId)) return null;

      const title = childNote.title || childNote.noteId;
      const childCount = Array.isArray(childNote.childBranchIds)
        ? childNote.childBranchIds.length
        : Array.isArray(childNote.childNoteIds)
          ? childNote.childNoteIds.length
          : 0;

      return {
        noteId: childNote.noteId,
        title,
        type: childNote.type || 'text',
        mime: childNote.mime,
        path: `${pathBase}/${title}`,
        href: makeHref(env.TRILIUM_BASE_URL, childNote.noteId),
        prefix: ref.prefix,
        childCount,
        hasChildren: childCount > 0,
        loaded: false,
        dateCreated: childNote.dateCreated,
        dateModified: childNote.dateModified,
      } satisfies LazyTreeNode;
    } catch (error) {
      pushDebugFailure(debugInfo, {
        noteId: ref.noteId,
        branchId: ref.branchId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  });

  return resolved.filter((item): item is LazyTreeNode => item !== null);
}

async function buildOfficialStyleTreeMap(
  env: Env,
  rootId: string,
  noteCache: Map<string, TriliumNote>,
  branchCache: Map<string, TriliumBranch>,
  debugInfo: DebugInfo,
) {
  const rootNote = await getNote(env, rootId, noteCache, debugInfo);
  const ignoreExcludeFromNoteMap = shouldExcludeFromTree(rootNote);
  const maxNodes = Math.max(50, Math.min(3000, Number(env.MAP_MAX_NODES || '1200')));

  const notesMap = new Map<string, TriliumNote>();
  const links: NoteMapLink[] = [];
  const visited = new Set<string>();

  async function walk(noteId: string): Promise<void> {
    if (visited.has(noteId) || notesMap.size >= maxNodes) return;
    visited.add(noteId);

    const note = await getNote(env, noteId, noteCache, debugInfo);
    if (!ignoreExcludeFromNoteMap && shouldExcludeVisibleNote(note, rootId)) return;

    notesMap.set(note.noteId, note);

    const branchIds = Array.isArray(note.childBranchIds) ? note.childBranchIds : [];
    for (const branchId of branchIds) {
      if (notesMap.size >= maxNodes) break;
      const branch = await getBranch(env, branchId, branchCache, debugInfo);
      const child = await getNote(env, branch.noteId, noteCache, debugInfo);
      if (!ignoreExcludeFromNoteMap && shouldExcludeVisibleNote(child, rootId)) continue;

      links.push({
        id: `${note.noteId}-${branch.noteId}`,
        sourceNoteId: note.noteId,
        targetNoteId: branch.noteId,
        name: 'child',
      });

      await walk(branch.noteId);
    }
  }

  await walk(rootId);

  const notes: NoteMapNodeTuple[] = Array.from(notesMap.values()).map((note) => [
    note.noteId,
    note.title || note.noteId,
    note.type || 'text',
    getColorLabel(note),
  ]);

  const noteIdToDescendantCountMap = await buildDescendantCountMap(env, Array.from(notesMap.keys()), noteCache, debugInfo);

  return {
    notes,
    links,
    noteIdToDescendantCountMap,
    rootNoteId: rootId,
    generatedAt: new Date().toISOString(),
    mode: 'official-tree-compatible',
  };
}

function parseUrl(request: Request) {
  const url = new URL(request.url);
  return {
    pathname: url.pathname,
    rootNoteId: url.searchParams.get('rootNoteId') || undefined,
    debug: url.searchParams.get('debug') === '1' || url.searchParams.get('debug') === 'true',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return json({ ok: true }, { status: 204 }, env);
    }

    const { pathname, rootNoteId, debug } = parseUrl(request);

    if (pathname === '/' || pathname === '/healthz') {
      return json(
        {
          ok: true,
          service: 'trilium-tree-proxy',
          endpoints: ['/api/trilium-tree', '/api/note-map/tree', '/healthz'],
          mode: 'visible-root-first',
        },
        { status: 200 },
        env,
      );
    }

    if (pathname !== '/api/trilium-tree' && pathname !== '/api/note-map/tree') {
      return json({ ok: false, error: 'Not Found' }, { status: 404 }, env);
    }

    if (!env.TRILIUM_BASE_URL) {
      return json({ ok: false, error: 'TRILIUM_BASE_URL is missing' }, { status: 500 }, env);
    }

    if (!env.TRILIUM_ETAPI_TOKEN) {
      return json({ ok: false, error: 'TRILIUM_ETAPI_TOKEN is missing' }, { status: 500 }, env);
    }

    const rootId = rootNoteId || env.ROOT_NOTE_ID || 'root';
    const noteCache = new Map<string, TriliumNote>();
    const branchCache = new Map<string, TriliumBranch>();
    const debugInfo: DebugInfo = {};

    try {
      if (pathname === '/api/note-map/tree') {
        const payload = await buildOfficialStyleTreeMap(env, rootId, noteCache, branchCache, debugInfo);
        return json(
          {
            ok: true,
            ...payload,
            ...(debug ? { debug: debugInfo } : {}),
          },
          { status: 200 },
          env,
        );
      }

      const rootNote = await getNote(env, rootId, noteCache, debugInfo);
      const rootTitle = rootNote.title || rootNote.noteId;
      const rootPath = `/${rootTitle}`;
      const children = await resolveChildrenOneLevel(env, rootNote, rootPath, branchCache, noteCache, debugInfo);

      debugInfo.rootType = rootNote.type;
      debugInfo.rootTitle = rootTitle;
      debugInfo.childBranchCount = Array.isArray(rootNote.childBranchIds) ? rootNote.childBranchIds.length : 0;
      debugInfo.childNoteCount = Array.isArray(rootNote.childNoteIds) ? rootNote.childNoteIds.length : 0;

      return json(
        {
          ok: true,
          mode: 'lazy-one-level',
          rootNoteId: rootId,
          generatedAt: new Date().toISOString(),
          root: {
            noteId: rootNote.noteId,
            title: rootTitle,
            type: rootNote.type || 'text',
            mime: rootNote.mime,
            path: rootPath,
            href: makeHref(env.TRILIUM_BASE_URL, rootNote.noteId),
            childCount: children.length,
            hasChildren: children.length > 0,
            loaded: true,
            children,
            dateCreated: rootNote.dateCreated,
            dateModified: rootNote.dateModified,
          },
          ...(debug ? { debug: debugInfo } : {}),
        },
        { status: 200 },
        env,
      );
    } catch (error) {
      return json(
        {
          ok: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          ...(debug ? { debug: debugInfo } : {}),
        },
        { status: 500 },
        env,
      );
    }
  },
};
