'use strict';

const fs = require('node:fs');
const path = require('node:path');

const icons = [
  'activity', 'cable', 'check', 'chevron-down', 'circle-alert', 'clipboard',
  'copy', 'external-link', 'pause', 'play', 'refresh-cw', 'search', 'trash-2', 'wifi-off'
];
const source = path.join(__dirname, '..', 'node_modules', 'lucide-static', 'icons');
const target = path.join(__dirname, '..', 'src', 'icons');
fs.mkdirSync(target, { recursive: true });
for (const name of icons) fs.copyFileSync(path.join(source, `${name}.svg`), path.join(target, `${name}.svg`));
