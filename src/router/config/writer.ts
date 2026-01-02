import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { parseDocument } from './loader';
import type { RouterProfile, RouterConfig } from './schema';
import { getConfigPath } from './loader';

/**
 * Save a router profile to config.yaml (preserves comments)
 */
export async function saveRouterProfile(name: string, profile: RouterProfile): Promise<void> {
  const configPath = getConfigPath();

  // Parse as document to preserve comments
  const doc = existsSync(configPath)
    ? parseDocument(readFileSync(configPath, 'utf-8'))
    : parseDocument('');

  // Ensure router.profiles section exists
  if (!doc.has('router')) {
    doc.set('router', { profiles: {} });
  }
  const router = doc.get('router') as Record<string, unknown>;
  if (!router.profiles) {
    doc.setIn(['router', 'profiles'], {});
  }

  // Add/update profile
  doc.setIn(['router', 'profiles', name], profile);

  // Write back (preserves comments)
  writeFileSync(configPath, doc.toString(), 'utf-8');
}

/**
 * Delete a router profile from config.yaml (preserves comments)
 */
export async function deleteRouterProfile(name: string): Promise<boolean> {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return false;
  }

  const doc = parseDocument(readFileSync(configPath, 'utf-8'));
  const profiles = doc.getIn(['router', 'profiles']) as Record<string, unknown> | undefined;

  if (!profiles?.[name]) {
    return false;
  }

  doc.deleteIn(['router', 'profiles', name]);
  writeFileSync(configPath, doc.toString(), 'utf-8');

  return true;
}

/**
 * Update router defaults in config.yaml (preserves comments)
 */
export async function updateRouterDefaults(
  defaults: Partial<RouterConfig['defaults']>
): Promise<void> {
  const configPath = getConfigPath();

  const doc = existsSync(configPath)
    ? parseDocument(readFileSync(configPath, 'utf-8'))
    : parseDocument('');

  if (!doc.has('router')) {
    doc.set('router', {});
  }

  const existingDefaults = (doc.getIn(['router', 'defaults']) as Record<string, unknown>) ?? {};
  doc.setIn(['router', 'defaults'], { ...existingDefaults, ...defaults });

  writeFileSync(configPath, doc.toString(), 'utf-8');
}
