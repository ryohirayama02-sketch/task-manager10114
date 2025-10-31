#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import process from 'node:process';

const PROJECT_ROOT = process.cwd();
const STATE_DIR = join(PROJECT_ROOT, '.workflow');
const STATE_FILE = join(STATE_DIR, 'state.json');
const EDIT_THRESHOLD = 5;
const NPM_COMMAND = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const CONFIG_FILES = new Set([
  'angular.json',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.spec.json',
  'tsconfig.typecheck.json',
  'webpack.config.js',
  '.eslintignore',
  '.eslintrc.js',
  '.editorconfig',
  '.vscode/settings.json',
  '.vscode/tasks.json',
  '.vscode/launch.json',
  '.vscode/extensions.json',
  'firebase.json',
  'firestore.rules',
  'firestore.indexes.json'
]);

const UI_EXTENSIONS = new Set([
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.pcss',
  '.html',
  '.htm'
]);

const IGNORED_PATTERNS = [
  (file) => file.startsWith('functions/'),
  (file) => file.startsWith('src/app/src/'),
  (file) => file.endsWith('.spec.ts')
];

main().catch((error) => {
  console.error('[workflow] Unexpected failure:', error);
  process.exit(1);
});

function main() {
  const changedFiles = detectChangedFiles();
  const hasChanges = changedFiles.length > 0;
  if (!hasChanges) {
    console.log('[workflow] No pending changes detected. Nothing to validate.');
    return;
  }

  const relevantFiles = changedFiles.filter((file) => !isIgnored(file));
  const hasRelevantChanges = relevantFiles.length > 0;
  const uiOnlyChange =
    hasRelevantChanges &&
    relevantFiles.every((file) => UI_EXTENSIONS.has(extname(file).toLowerCase()));
  const configChanged = changedFiles.some(isConfigFile);

  if (!hasRelevantChanges) {
    console.log('[workflow] Only excluded paths changed; skipping lint/type-check.');
  } else if (uiOnlyChange) {
    console.log('[workflow] UI-only change detected; skipping lint/type-check.');
  } else {
    console.log('[workflow] Running lint (excluded: functions/, src/app/src/, *.spec.ts)...');
    if (!runNpmScript('lint')) {
      markRunFailed();
      process.exit(1);
    }

    console.log('[workflow] Running TypeScript type-check...');
    if (!runNpmScript('type-check')) {
      markRunFailed();
      process.exit(1);
    }
  }

  finalizeRun({ isEdit: true, configChanged });
}

function runNpmScript(script) {
  const result = spawnSync(NPM_COMMAND, ['run', script], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit'
  });
  return result.status === 0;
}

function detectChangedFiles() {
  const status = spawnSync('git', ['status', '--porcelain'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8'
  });

  if (status.status !== 0 || !status.stdout) {
    return [];
  }

  const files = new Set();
  status.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const separatorIndex = line.indexOf('->');
      let filePath;
      if (separatorIndex !== -1) {
        filePath = line.slice(separatorIndex + 2).trim();
      } else {
        filePath = line.slice(2).trim();
      }

      if (filePath) {
        files.add(normalizePath(filePath));
      }
    });

  return Array.from(files);
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/');
}

function isIgnored(file) {
  return IGNORED_PATTERNS.some((predicate) => predicate(file));
}

function isConfigFile(file) {
  if (CONFIG_FILES.has(file)) {
    return true;
  }

  return (
    file.startsWith('.vscode/') ||
    file.startsWith('.angular/') ||
    file.startsWith('.firebase/') ||
    file.startsWith('src/environments/')
  );
}

function markRunFailed() {
  const state = loadState();
  state.lastHadErrors = true;
  persistState(state);
}

function finalizeRun({ isEdit, configChanged }) {
  const state = loadState();
  const previousHadErrors = state.lastHadErrors === true;
  const priorEditsSinceBuild = Number.isFinite(state.editsSinceBuild)
    ? state.editsSinceBuild
    : 0;
  const priorTotalEdits = Number.isFinite(state.totalEdits) ? state.totalEdits : 0;

  const editsSinceBuild = isEdit ? priorEditsSinceBuild + 1 : priorEditsSinceBuild;
  const totalEdits = isEdit ? priorTotalEdits + 1 : priorTotalEdits;
  const reachedThreshold = editsSinceBuild >= EDIT_THRESHOLD;

  const buildReasons = [];
  if (previousHadErrors) {
    buildReasons.push('previous errors');
  }
  if (configChanged) {
    buildReasons.push('config changes');
  }
  if (reachedThreshold) {
    buildReasons.push(`edit threshold (${EDIT_THRESHOLD})`);
  }

  const shouldRunBuild = buildReasons.length > 0;

  if (shouldRunBuild) {
    console.log(`[workflow] Triggering full build due to: ${buildReasons.join(', ')}.`);
    const buildSucceeded = runNpmScript('build');
    if (!buildSucceeded) {
      state.lastHadErrors = true;
      state.editsSinceBuild = editsSinceBuild;
      state.totalEdits = totalEdits;
      persistState(state);
      process.exit(1);
    }
    console.log('[workflow] Full build completed successfully.');
    state.editsSinceBuild = 0;
    state.lastHadErrors = false;
  } else {
    state.editsSinceBuild = editsSinceBuild;
    state.lastHadErrors = false;
  }

  state.totalEdits = totalEdits;
  persistState(state);
}

function loadState() {
  try {
    if (existsSync(STATE_FILE)) {
      const content = readFileSync(STATE_FILE, 'utf8');
      if (content) {
        return JSON.parse(content);
      }
    }
  } catch {
    // Ignore parse errors and fall back to default.
  }
  return {
    editsSinceBuild: 0,
    totalEdits: 0,
    lastHadErrors: false
  };
}

function persistState(state) {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
