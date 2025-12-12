/**
 * Install/Uninstall Command Handlers
 *
 * Handle --install and --uninstall commands for CCS.
 */

import { info, color, initUI } from '../utils/ui';

/**
 * Handle install command
 */
export async function handleInstallCommand(): Promise<void> {
  await initUI();
  console.log('');
  console.log(info('Feature not available'));
  console.log('');
  console.log('The --install flag is currently under development.');
  console.log('.claude/ integration testing is not complete.');
  console.log('');
  console.log(`For updates: ${color('https://github.com/kaitranntt/ccs/issues', 'path')}`);
  console.log('');
  process.exit(0);
}

/**
 * Handle uninstall command
 */
export async function handleUninstallCommand(): Promise<void> {
  await initUI();
  console.log('');
  console.log(info('Feature not available'));
  console.log('');
  console.log('The --uninstall flag is currently under development.');
  console.log('.claude/ integration testing is not complete.');
  console.log('');
  console.log(`For updates: ${color('https://github.com/kaitranntt/ccs/issues', 'path')}`);
  console.log('');
  process.exit(0);
}
