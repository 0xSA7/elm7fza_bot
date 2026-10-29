#!/usr/bin/env node
'use strict';

/**
 * run.js — مُشغّل الاختبارات المحلي
 * بيحاكي بيئة Apps Script بـ vm module ويشغّل الاختبارات
 * الاستخدام: node tests/run.js
 * الخروج بـ 1 لو فيه فشل → الـ CI يوقف الـ deploy
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ═══════════════ 1) محاكاة خدمات Apps Script ═══════════════

const mockSheetStore = {};

function mockSheet(name) {
  if (!mockSheetStore[name]) mockSheetStore[name] = { data: [], frozen: 0 };
  const store = mockSheetStore[name];

  function ensureRows(upto) {
    while (store.data.length < upto) store.data.push(new Array(12).fill(''));
  }

  return {
    getName: () => name,
    getLastRow: () => store.data.length + (store.frozen > 0 ? 0 : 0),
    appendRow: (row) => { store.data.push(row.slice()); },
    getRange: (row, col, numRows, numCols) => ({
      getValues: () => {
        const out = [];
        for (let i = 0; i < (numRows || 1); i++) {
          const r = store.data[row - 1 + i] || [];
          out.push(r.slice(col - 1, col - 1 + (numCols || 1)));
        }
        return out;
      },
      setValues: (vals) => {
        for (let i = 0; i < vals.length; i++) {
          ensureRows(row + i);
          for (let j = 0; j < vals[i].length; j++) {
            if (!store.data[row - 1 + i]) store.data[row - 1 + i] = [];
            store.data[row - 1 + i][col - 1 + j] = vals[i][j];
          }
        }
      },
      setValue: (val) => {
        ensureRows(row);
        if (!store.data[row - 1]) store.data[row - 1] = [];
        store.data[row - 1][col - 1] = val;
      }
    }),
    deleteRow: (row) => { store.data.splice(row - 1, 1); },
    deleteRows: (row, count) => { store.data.splice(row - 1, count); },
    setFrozenRows: (n) => { store.frozen = n; },
    clear: () => { store.data = []; },
    getCharts: () => [],
    newChart: () => { throw new Error('charts غير مدعومة في الاختبارات'); },
    insertChart: () => {},
    removeChart: () => {},
    setColumnWidth: () => {}
  };
}

const mockProps = {};

const mocks = {
  console: { log: () => {}, warn: () => {}, error: () => {} }, // كتم Apps Script logs
  Logger:  { log: () => {} },

  Session: { getScriptTimeZone: () => 'Africa/Cairo' },

  Utilities: {
    formatDate: (d, tz, fmt) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      if (fmt === 'yyyy-MM') return y + '-' + m;
      if (fmt === 'yyyy-MM-dd HH:mm:ss')
        return y + '-' + m + '-' + day + ' ' +
               String(d.getHours()).padStart(2, '0') + ':' +
               String(d.getMinutes()).padStart(2, '0') + ':00';
      if (fmt === "yyyy-MM-dd'T'HH:mm:ss")
        return y + '-' + m + '-' + day + 'T00:00:00';
      return y + '-' + m + '-' + day;
    },
    base64Encode: (s) => Buffer.from(s).toString('base64'),
    sleep: () => {},
    newBlob: () => ({}),
    gzip: () => ({}),
    ungzip: () => ({ getDataAsString: () => '' })
  },

  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({
      getUrl: () => 'https://sheets.example.com/fake',
      getSheetByName: (n) => mockSheetStore[n] ? mockSheet(n) : null,
      insertSheet: (n) => mockSheet(n)
    })
  },

  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (k) => mockProps[k] !== undefined ? mockProps[k] : null,
      setProperty: (k, v) => { mockProps[k] = String(v); },
      deleteProperty: (k) => { delete mockProps[k]; }
    })
  },

  CacheService: {
    getScriptCache: () => ({
      get: () => null,
      put: () => {}
    })
  },

  LockService: {
    getScriptLock: () => ({
      tryLock: () => true,
      waitLock: () => true,
      releaseLock: () => {}
    })
  },

  ScriptApp: {
    getProjectTriggers: () => [],
    newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => ({}) }) }) }),
    deleteTrigger: () => {}
  },

  DriveApp: {
    getFoldersByName: () => ({ hasNext: () => false }),
    createFolder: () => ({ getId: () => 'mock-folder', getFiles: () => ({ hasNext: () => false }) }),
    getFolderById: () => ({ getFiles: () => ({ hasNext: () => false }) })
  },

  UrlFetchApp: {
    fetch: () => ({ getResponseCode: () => 200, getContentText: () => '{"ok":true}' })
  },

  ContentService: { createTextOutput: () => ({}) }
};

// ═══════════════ 2) تحميل ملفات المشروع ═══════════════

const root = path.join(__dirname, '..');
const context = vm.createContext(mocks);

// الترتيب مهم — كل ملف بيعتمد على اللي قبله
const loadOrder = [
  'Config.js', 'Core.js', 'Models.js', 'Repositories.js',
  'IntentRouter.js', 'FinanceService.js', 'IntelligenceService.js',
  'TelegramClient.js', 'GeminiClient.js', 'Router.js',
  'RetryQueue.js', 'PollingEngine.js', 'DashboardService.js',
  'BackupService.js', 'AppContext.js', 'App.js'
];

for (const file of loadOrder) {
  const fp = path.join(root, file);
  if (fs.existsSync(fp)) {
    vm.runInContext(fs.readFileSync(fp, 'utf8'), context, { filename: file });
  }
}

// ═══════════════ 3) إطار الاختبار البسيط ═══════════════

vm.runInContext(`
  var __tests = [];
  var test = function(name, fn) { __tests.push({ name: name, fn: fn }); };
  var expect = function(actual) {
    return {
      toBe: function(exp) {
        if (actual !== exp)
          throw new Error('expected "' + JSON.stringify(exp) + '" got "' + JSON.stringify(actual) + '"');
      },
      toEqual: function(exp) {
        if (JSON.stringify(actual) !== JSON.stringify(exp))
          throw new Error('expected ' + JSON.stringify(exp) + ' got ' + JSON.stringify(actual));
      },
      toBeTruthy: function() {
        if (!actual) throw new Error('expected truthy, got: ' + JSON.stringify(actual));
      },
      toBeNull: function() {
        if (actual !== null) throw new Error('expected null, got: ' + JSON.stringify(actual));
      },
      toContain: function(exp) {
        if (String(actual).indexOf(exp) === -1)
          throw new Error('expected to contain "' + exp + '", got: ' + JSON.stringify(actual));
      },
      toBeGreaterThanOrEqual: function(exp) {
        if (!(actual >= exp))
          throw new Error('expected >= ' + exp + ', got: ' + actual);
      },
      get not() {
        var self = this;
        return {
          toBe: function(exp) {
            if (actual === exp) throw new Error('expected NOT to be "' + exp + '"');
          },
          toBeNull: function() {
            if (actual === null) throw new Error('expected NOT null');
          },
          toContain: function(exp) {
            if (String(actual).indexOf(exp) !== -1)
              throw new Error('expected NOT to contain "' + exp + '", but it does');
          }
        };
      }
    };
  };
`, context);

// ═══════════════ 4) تشغيل ملفات الاختبار ═══════════════

const testFiles = fs.readdirSync(__dirname)
  .filter(f => f.startsWith('test-') && f.endsWith('.js'))
  .sort();

let passed = 0, failed = 0;

for (const tf of testFiles) {
  console.log('\n📁 ' + tf.replace('test-', '').replace('.js', ''));
  vm.runInContext(fs.readFileSync(path.join(__dirname, tf), 'utf8'), context, { filename: tf });

  const tests = vm.runInContext('__tests.splice(0)', context);
  for (const t of tests) {
    try {
      t.fn();
      passed++;
      console.log('  ✅ ' + t.name);
    } catch (e) {
      failed++;
      console.log('  ❌ ' + t.name);
      console.log('     ' + e.message);
    }
  }
}

// ═══════════════ 5) النتيجة ═══════════════

console.log('\n' + '═'.repeat(50));
console.log('📊 ' + passed + ' passed | ' + failed + ' failed | ' + (passed + failed) + ' total');
if (failed > 0) {
  console.log('❌ TESTS FAILED — الـ deploy متوقف');
  process.exit(1);
}
console.log('✅ ALL TESTS PASSED');