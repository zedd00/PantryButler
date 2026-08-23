#!/usr/bin/env node

/**
 * Database Query Validation Test (Offline Version)
 *
 * Validates the raw SQL used by the self-hosted Hono/PostgreSQL server against
 * the schema defined in server/src/db/schema.sql (plus migrations), without
 * needing database access.
 *
 * Rewritten for the post-Supabase stack: the old validator looked for
 * Supabase-style `.from('table')` / `.select('col')` chains in the client,
 * which no longer exist. The server now runs raw SQL via `query(...)`, so this
 * scans server/src for SQL literals and checks:
 *   - referenced tables exist in the schema (errors, exit 1)
 *   - referenced columns exist on their table (warnings, exit 0)
 *
 * Run with: node tests/validate-queries-offline.mjs
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER',
  'CROSS', 'ON', 'AS', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'GROUP', 'BY',
  'ORDER', 'LIMIT', 'OFFSET', 'SET', 'VALUES', 'RETURNING', 'INTO', 'USING',
  'UPDATE', 'DELETE', 'INSERT', 'HAVING', 'DISTINCT', 'WHEN', 'THEN', 'ELSE',
  'END', 'CASE', 'BETWEEN', 'LIKE', 'ILIKE', 'EXISTS', 'ANY', 'ALL', 'UNION',
  'WITH', 'DO', 'NOTHING', 'TRUE', 'FALSE', 'ASC', 'DESC', 'RETURN', 'BEGIN',
  'COMMIT', 'ROLLBACK', 'TABLE', 'ALTER', 'CREATE', 'UNIQUE', 'INDEX',
]);

const COLUMN_SKIP_WORDS = new Set([
  'CONSTRAINT', 'UNIQUE', 'PRIMARY', 'FOREIGN', 'CHECK', 'REFERENCES',
  'EXCLUDE', 'ON', 'KEY', 'USING',
]);

function readString(src, start) {
  const q = src[start];
  if (q !== "'" && q !== '"' && q !== '`') return null;
  let i = start + 1;
  let out = '';
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      out += c;
      i++;
      if (i < src.length) {
        out += src[i];
        i++;
      }
      continue;
    }
    if (c === q) return { text: out, end: i + 1 };
    out += c;
    i++;
  }
  return null;
}

function stripInterpolation(sql) {
  return sql.replace(/\$\{[^}]*\}/g, 'x');
}

function parseColumns(tableBody) {
  const cols = new Set();
  for (const raw of tableBody.split('\n')) {
    const line = raw.replace(/--.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\b/);
    if (!m) continue;
    const name = m[1];
    if (COLUMN_SKIP_WORDS.has(name.toUpperCase())) continue;
    cols.add(name.toLowerCase());
  }
  return cols;
}

function parseTables(sqlText) {
  const tables = new Map();
  const tableRegex = /CREATE TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(\w+)\s*\(([\s\S]*?)\);/gi;
  let match;
  while ((match = tableRegex.exec(sqlText)) !== null) {
    const name = match[1].toLowerCase();
    if (!tables.has(name)) tables.set(name, new Set());
    for (const col of parseColumns(match[2])) tables.get(name).add(col);
  }
  return tables;
}

function applyMigration(tables, sqlText) {
  const createRegex = /CREATE TABLE IF NOT EXISTS\s+(\w+)\s*\(([\s\S]*?)\);/gi;
  let match;
  while ((match = createRegex.exec(sqlText)) !== null) {
    const name = match[1].toLowerCase();
    if (!tables.has(name)) tables.set(name, new Set());
    for (const col of parseColumns(match[2])) tables.get(name).add(col);
  }
  const alterRegex = /ALTER TABLE\s+(\w+)\s+ADD COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  while ((match = alterRegex.exec(sqlText)) !== null) {
    const name = match[1].toLowerCase();
    if (!tables.has(name)) tables.set(name, new Set());
    tables.get(name).add(match[2].toLowerCase());
  }
}

function tokenizeLiterals(content) {
  const literals = [];
  let i = 0;
  const n = content.length;
  while (i < n) {
    const c = content[i];
    if (c === '/' && content[i + 1] === '/') {
      while (i < n && content[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && content[i + 1] === '*') {
      i += 2;
      while (i < n && !(content[i] === '*' && content[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const lit = readString(content, i);
      if (lit) {
        literals.push({ text: lit.text, start: i, end: lit.end });
        i = lit.end;
        continue;
      }
    }
    i++;
  }
  return literals;
}

function extractSqlStrings(fileContent, isMigrations) {
  const results = [];
  for (const lit of tokenizeLiterals(fileContent)) {
    let isQuery = isMigrations;
    if (!isQuery) {
      const before = fileContent.slice(Math.max(0, lit.start - 60), lit.start);
      isQuery = /(?:pool|client|db)\.query\s*\(\s*$/.test(before) || /query\s*\(\s*$/.test(before);
    }
    if (isQuery) {
      const line = fileContent.substring(0, lit.start).split('\n').length;
      results.push({ sql: stripInterpolation(lit.text), line });
    }
  }
  return results;
}

function findMatchingParen(text, index) {
  let depth = 0;
  for (let i = index; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseFromClauses(text) {
  const aliases = new Map();
  const derived = new Set();
  const tables = [];
  const fromRe = /(?:FROM|JOIN)\s+/gi;
  let m;
  while ((m = fromRe.exec(text)) !== null) {
    let i = fromRe.lastIndex;
    let isDerived = false;
    let tableName = null;
    while (i < text.length && /\s/.test(text[i])) i++;
    if (text[i] === '(') {
      isDerived = true;
      const close = findMatchingParen(text, i);
      if (close === -1) continue;
      i = close + 1;
    } else {
      const wordMatch = text.slice(i).match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (!wordMatch) continue;
      const name = wordMatch[1].toLowerCase();
      i += wordMatch[1].length;
      if (text[i] === '(') {
        isDerived = true;
        const close = findMatchingParen(text, i);
        if (close === -1) continue;
        i = close + 1;
      } else if (!SQL_KEYWORDS.has(name.toUpperCase())) {
        tableName = name;
        tables.push(name);
      }
    }
    while (i < text.length && /\s/.test(text[i])) i++;
    let alias = null;
    if (text.slice(i, i + 2).toUpperCase() === 'AS') {
      i += 2;
      while (i < text.length && /\s/.test(text[i])) i++;
    }
    const aliasMatch = text.slice(i).match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (aliasMatch && !SQL_KEYWORDS.has(aliasMatch[1].toUpperCase())) {
      alias = aliasMatch[1].toLowerCase();
    }
    if (!alias) continue;
    if (isDerived || !tableName) {
      derived.add(alias);
    } else {
      aliases.set(alias, tableName);
    }
  }
  return { aliases, derived, tables };
}

function cleanSql(sql) {
  return sql.replace(/'(?:[^']|'')*'/g, "''");
}

function analyzeSql(sql, knownTables) {
  const tables = [];
  const columns = [];
  const unresolved = [];
  const text = cleanSql(sql);

  const { aliases, derived, tables: fromTables } = parseFromClauses(text);
  for (const t of fromTables) tables.push(t);

  const updateRe = /\bUPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+([a-zA-Z_][a-zA-Z0-9_]*))?/gi;
  let m;
  while ((m = updateRe.exec(text)) !== null) {
    const name = m[1].toLowerCase();
    if (SQL_KEYWORDS.has(name.toUpperCase())) continue;
    tables.push(name);
    const alias = m[2];
    if (alias && !SQL_KEYWORDS.has(alias.toUpperCase()) && !aliases.has(alias.toLowerCase())) {
      aliases.set(alias.toLowerCase(), name);
    }
  }

  const tableRe = /\b(?:INSERT\s+INTO|ALTER\s+TABLE|CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?|TRUNCATE(?:\s+TABLE)?)\s+([a-z_][a-z0-9_]*)/gi;
  while ((m = tableRe.exec(text)) !== null) {
    const name = m[1].toLowerCase();
    if (!SQL_KEYWORDS.has(name.toUpperCase())) tables.push(name);
  }

  let lastInsertTable = null;
  let lastUpdateTable = null;
  const events = [];
  const insertRe = /\bINSERT\s+INTO\s+([a-z_][a-z0-9_]*)\s*\(([^)]*)\)/gi;
  while ((m = insertRe.exec(text)) !== null) {
    events.push({ index: m.index, kind: 'insert', table: m[1].toLowerCase(), cols: m[2] });
  }
  const conflictRe = /\bON\s+CONFLICT\s*\(([^)]*)\)/gi;
  while ((m = conflictRe.exec(text)) !== null) {
    events.push({ index: m.index, kind: 'conflict', cols: m[1] });
  }
  const updateSetRe = /\bUPDATE\s+([a-z_][a-z0-9_]*)(?:\s+[a-z_][a-z0-9_]*)?\s+SET/gi;
  while ((m = updateSetRe.exec(text)) !== null) {
    if (SQL_KEYWORDS.has(m[1].toUpperCase())) continue;
    events.push({ index: m.index, kind: 'update', table: m[1].toLowerCase() });
  }
  const returningRe = /\bRETURNING\s+([^;]*?)(?=\bINTO\b|\bUSING\b|;|$)/gi;
  while ((m = returningRe.exec(text)) !== null) {
    events.push({ index: m.index, kind: 'returning', cols: m[1] });
  }
  const doUpdateRe = /\bDO\s+UPDATE\s+SET\s+([\s\S]*?)(?=\bWHERE\b|;|$)/gi;
  while ((m = doUpdateRe.exec(text)) !== null) {
    events.push({ index: m.index, kind: 'do_update', cols: m[1] });
  }

  events.sort((a, b) => a.index - b.index);
  const pushColumn = (table, name) => {
    const clean = name.trim().toLowerCase();
    if (clean && clean !== '*' && !clean.includes('.')) columns.push({ table, column: clean });
  };
  for (const ev of events) {
    if (ev.kind === 'insert') {
      lastInsertTable = ev.table;
      for (const col of ev.cols.split(',')) pushColumn(lastInsertTable, col);
    } else if (ev.kind === 'conflict') {
      if (!lastInsertTable) continue;
      for (const col of ev.cols.split(',')) pushColumn(lastInsertTable, col);
    } else if (ev.kind === 'update') {
      lastUpdateTable = ev.table;
      const segment = text.substring(ev.index).match(/^[\s\S]*?\bSET\s+([\s\S]*?)(?=\bWHERE\b|\bRETURNING\b|;|$)/i);
      if (segment) {
        const setRe = /\b([a-z_][a-z0-9_]*)\s*=/g;
        let cm;
        while ((cm = setRe.exec(segment[1])) !== null) {
          pushColumn(lastUpdateTable, cm[1]);
        }
      }
    } else if (ev.kind === 'returning') {
      const target = lastInsertTable || lastUpdateTable;
      if (!target) continue;
      for (const col of ev.cols.split(',')) pushColumn(target, col.replace(/^["']|["']$/g, ''));
    } else if (ev.kind === 'do_update') {
      if (!lastInsertTable) continue;
      const setRe = /\b([a-z_][a-z0-9_]*)\s*=/g;
      let cm;
      while ((cm = setRe.exec(ev.cols)) !== null) {
        pushColumn(lastInsertTable, cm[1]);
      }
    }
  }

  const qualRe = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  while ((m = qualRe.exec(text)) !== null) {
    const lhs = m[1].toLowerCase();
    const col = m[2].toLowerCase();
    if (lhs === 'old' || lhs === 'new' || lhs === 'excluded' || derived.has(lhs)) continue;
    const table = aliases.get(lhs) || (knownTables.has(lhs) ? lhs : null);
    if (table) {
      columns.push({ table, column: col });
    } else {
      unresolved.push({ qualifier: m[1], column: col });
    }
  }

  return { tables, columns, unresolved };
}

function validateReferences(tables, refs, sourceFile, line, sql) {
  const errors = [];
  const warnings = [];
  const missingTables = new Map();
  const missingColumns = new Map();
  const unresolved = new Map();

  for (const table of refs.tables) {
    if (!tables.has(table)) {
      const key = table;
      if (!missingTables.has(key)) missingTables.set(key, []);
      missingTables.get(key).push({ file: sourceFile, line, sql: sql.slice(0, 120) });
    }
  }

  for (const col of refs.columns) {
    if (!tables.has(col.table)) continue;
    if (!tables.get(col.table).has(col.column)) {
      const key = `${col.table}.${col.column}`;
      if (!missingColumns.has(key)) missingColumns.set(key, []);
      missingColumns.get(key).push({ file: sourceFile, line, sql: sql.slice(0, 120) });
    }
  }

  for (const u of refs.unresolved) {
    const key = `${u.qualifier}.${u.column}`;
    if (!unresolved.has(key)) unresolved.set(key, []);
    unresolved.get(key).push({ file: sourceFile, line, sql: sql.slice(0, 120) });
  }

  for (const [table, locations] of missingTables) {
    errors.push({ type: 'missing_table', table, locations });
  }
  for (const [key, locations] of missingColumns) {
    const [table, column] = key.split('.');
    warnings.push({ type: 'missing_column', table, column, locations });
  }
  for (const [key, locations] of unresolved) {
    const [qualifier, column] = key.split('.');
    warnings.push({ type: 'unresolved_qualifier', table: qualifier, column, locations });
  }

  return { errors, warnings };
}

function main() {
  console.log(`${colors.blue}${colors.bold}╔═══════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}${colors.bold}║   Database Query Validation (Offline)                ║${colors.reset}`);
  console.log(`${colors.blue}${colors.bold}╚═══════════════════════════════════════════════════════╝${colors.reset}\n`);

  const schemaPath = path.join(__dirname, '..', 'server', 'src', 'db', 'schema.sql');
  const migrationsPath = path.join(__dirname, '..', 'server', 'src', 'db', 'migrations.ts');
  const srcDir = path.join(__dirname, '..', 'server', 'src');

  if (!fs.existsSync(schemaPath)) {
    console.error(`${colors.red}❌ Schema file not found: ${schemaPath}${colors.reset}`);
    process.exit(1);
  }

  const tables = parseTables(fs.readFileSync(schemaPath, 'utf-8'));
  tables.set('schema_migrations', new Set(['name', 'hash', 'applied_at']));
  const migrationsSql = fs.existsSync(migrationsPath) ? fs.readFileSync(migrationsPath, 'utf-8') : '';
  applyMigration(tables, migrationsSql);
  const knownTables = new Set(tables.keys());

  console.log(`${colors.green}✓ Parsed ${tables.size} tables from schema (+ migrations)${colors.reset}\n`);

  let filesScanned = 0;
  let statements = 0;
  const allErrors = [];
  const allWarnings = [];

  function scanDirectory(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') scanDirectory(fullPath);
      } else if (entry.name.endsWith('.ts')) {
        filesScanned++;
        const content = fs.readFileSync(fullPath, 'utf-8');
        const relativePath = path.relative(path.join(__dirname, '..', 'server'), fullPath);
        const isMigrations = fullPath === migrationsPath;
        for (const { sql, line } of extractSqlStrings(content, isMigrations)) {
          statements++;
          const refs = analyzeSql(sql, knownTables);
          const result = validateReferences(tables, refs, relativePath, line, sql);
          allErrors.push(...result.errors);
          allWarnings.push(...result.warnings);
        }
      }
    }
  }
  scanDirectory(srcDir);

  console.log(`${colors.cyan}🔍 Scanned ${filesScanned} files, ${statements} SQL statement(s)${colors.reset}\n`);

  for (const err of allErrors) {
    console.log(`${colors.red}${colors.bold}❌ Table not found: ${err.table}${colors.reset}`);
    for (const loc of err.locations.slice(0, 3)) {
      console.log(`   📄 ${loc.file}:${loc.line}`);
      if (loc.sql) console.log(`      ${colors.yellow}${loc.sql}${colors.reset}`);
    }
    if (err.locations.length > 3) console.log(`   ... and ${err.locations.length - 3} more`);
    console.log('');
  }

  const groupedWarnings = new Map();
  for (const w of allWarnings) {
    const key = `${w.type}:${w.table}.${w.column}`;
    if (!groupedWarnings.has(key)) groupedWarnings.set(key, w);
    else groupedWarnings.get(key).locations.push(...w.locations);
  }

  let shown = 0;
  for (const w of groupedWarnings.values()) {
    if (shown >= 10) {
      console.log(`${colors.yellow}   ... and ${groupedWarnings.size - 10} more warnings${colors.reset}\n`);
      break;
    }
    shown++;
    const label = w.type === 'missing_column'
      ? `${colors.yellow}⚠️  Column not in schema: ${w.table}.${w.column}${colors.reset}`
      : `${colors.yellow}⚠️  Unresolved qualifier (alias not tracked): ${w.table}.${w.column}${colors.reset}`;
    console.log(label);
    for (const loc of w.locations.slice(0, 2)) {
      console.log(`   📄 ${loc.file}:${loc.line}`);
    }
    if (w.locations.length > 2) console.log(`   ... and ${w.locations.length - 2} more`);
    console.log('');
  }

  console.log(`${colors.blue}${colors.bold}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}${colors.bold}              VALIDATION REPORT${colors.reset}`);
  console.log(`${colors.blue}${colors.bold}═══════════════════════════════════════════════════════${colors.reset}\n`);
  console.log(`   Tables in schema: ${colors.cyan}${tables.size}${colors.reset}`);
  console.log(`   Files Scanned:    ${colors.cyan}${filesScanned}${colors.reset}`);
  console.log(`   SQL Statements:   ${colors.cyan}${statements}${colors.reset}`);
  console.log(`   Errors:           ${allErrors.length > 0 ? colors.red : colors.green}${allErrors.length}${colors.reset}`);
  console.log(`   Warnings:         ${allWarnings.length > 0 ? colors.yellow : colors.green}${allWarnings.length}${colors.reset}\n`);

  if (allErrors.length === 0 && allWarnings.length === 0) {
    console.log(`   ${colors.green}${colors.bold}✅ All references valid!${colors.reset}\n`);
  }

  if (allErrors.length > 0) {
    console.log(`${colors.red}${colors.bold}❌ Validation failed: ${allErrors.length} error(s)${colors.reset}\n`);
    process.exit(1);
  } else if (allWarnings.length > 0) {
    console.log(`${colors.yellow}${colors.bold}⚠️  Completed with ${allWarnings.length} warning(s)${colors.reset}\n`);
    console.log(`${colors.yellow}💡 Warnings are usually false positives (aliases on derived tables, casts, etc.)${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.green}${colors.bold}✅ All validations passed!${colors.reset}\n`);
    process.exit(0);
  }
}

main();