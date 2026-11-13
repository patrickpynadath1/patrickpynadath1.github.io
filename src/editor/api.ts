// Dev-only endpoint behind /edit: GET returns a post's MDX source, PUT replaces it.
// Injected by the dev-editor integration in astro.config.mjs only under `astro dev`.
import type { APIRoute } from 'astro';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const prerender = false;

const BLOG = path.resolve('src/content/blog');

function postPath(slug: string | undefined): string | null {
  if (!import.meta.env.DEV || !slug || !/^[A-Za-z0-9_-]+$/.test(slug)) return null;
  const file = path.resolve(BLOG, `${slug}.mdx`);
  return path.dirname(file) === BLOG && file.endsWith('.mdx') ? file : null;
}

export const GET: APIRoute = async ({ params }) => {
  const file = postPath(params.slug);
  if (!file) return new Response('Not found', { status: 404 });
  try {
    return new Response(await readFile(file, 'utf8'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  const file = postPath(params.slug);
  if (!file) return new Response('Refused', { status: 403 });
  const text = await request.text();
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, text, 'utf8');
  await rename(tmp, file);
  return new Response('ok');
};
