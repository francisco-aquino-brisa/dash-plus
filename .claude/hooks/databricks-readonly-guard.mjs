#!/usr/bin/env node
/**
 * PreToolUse guard for every Databricks access path in this repo.
 *
 * The `databricks` MCP was removed (CLAUDE.md), so all warehouse access now runs
 * through `Bash(node scripts/query-databricks.mjs "<SQL>")`. This guard inspects
 * BOTH surfaces: the legacy MCP `execute_sql` tool (kept for safety) and any Bash
 * command that invokes `query-databricks.mjs` — it extracts the SQL argument and
 * applies the same read-only check.
 *
 * HARD READ-ONLY ENFORCEMENT: deterministically blocks any statement that is
 * not a pure read. The harness runs this before the tool call, so it does not
 * depend on the model "behaving". Fails CLOSED — anything it cannot positively
 * classify as read-only is denied.
 *
 * Allowed statement starters: SELECT, WITH, SHOW, DESCRIBE/DESC, EXPLAIN,
 * VALUES, TABLE, USE. Everything else (INSERT/UPDATE/DELETE/MERGE/DROP/CREATE/
 * ALTER/TRUNCATE/GRANT/REVOKE/COPY/OPTIMIZE/VACUUM/REFRESH/SET/...) is denied,
 * including stacked statements and CTEs that wrap a write.
 *
 * This is one layer of defense in depth — the credential should ALSO have only
 * read grants, and `query-databricks.mjs` self-enforces read-only too.
 */

const MCP_TOOL = "mcp__databricks__execute_sql";
const SCRIPT = "query-databricks.mjs";

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `[databricks read-only guard] ${reason}`,
      },
    }),
  );
  process.exit(0);
}

function allow() {
  // No output → normal permission flow proceeds (reads are not auto-granted here).
  process.exit(0);
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
    // If nothing arrives, don't hang forever.
    setTimeout(() => resolve(data), 2000);
  });
}

// Allowed read-only statement starters.
const READ_START = /^(select|with|show|describe|desc|explain|values|table|use)\b/i;

// Write / DDL / DML commands expressed in their *command* form (not as function
// names like replace()/array_remove()), so legitimate SELECTs are not blocked.
const FORBIDDEN_CMD = new RegExp(
  [
    "insert\\s+(into|overwrite)",
    "insert\\s+overwrite",
    "update\\s+\\S",
    "delete\\s+from",
    "merge\\s+into",
    "upsert\\s+",
    "drop\\s+",
    "create\\s+",
    "alter\\s+",
    "truncate\\s+",
    "grant\\s+",
    "revoke\\s+",
    "copy\\s+into",
    "restore\\s+",
    "optimize\\s+",
    "vacuum\\s+",
    "z?refresh\\s+",
    "(un)?cache\\s+",
    "msck\\s+",
    "comment\\s+on",
    "clone\\s+",
    "\\bcall\\s+",
    "\\bset\\s+\\S",
    "\\breset\\b",
    "\\bput\\s+",
    "\\bload\\s+data",
  ].join("|"),
  "i",
);

function stripNoise(sql) {
  let s = String(sql);
  s = s.replace(/\/\*[\s\S]*?\*\//g, " "); // block comments
  s = s.replace(/--[^\n]*/g, " "); // line comments
  s = s.replace(/'(?:''|[^'])*'/g, " '' "); // single-quoted string literals
  s = s.replace(/"(?:""|[^"])*"/g, ' "" '); // double-quoted literals/identifiers
  s = s.replace(/`[^`]*`/g, " `` "); // backtick identifiers
  return s;
}

function validate(sqlRaw) {
  if (!sqlRaw || !String(sqlRaw).trim()) return "empty statement";
  const cleaned = stripNoise(sqlRaw);
  const statements = cleaned
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
  if (statements.length === 0) return "no statement found";
  for (const st of statements) {
    if (!READ_START.test(st)) {
      return `statement is not read-only (must start with SELECT/WITH/SHOW/DESCRIBE/EXPLAIN/VALUES/TABLE/USE): "${st.slice(0, 60)}…"`;
    }
    if (FORBIDDEN_CMD.test(st)) {
      return `statement contains a write/DDL command: "${st.slice(0, 80)}…"`;
    }
  }
  return null; // ok
}

/**
 * Pull the SQL out of a `node scripts/query-databricks.mjs "<SQL>" [--flags]`
 * command. Returns { skip:true } when the command is not a query-databricks call
 * (or uses `--file`, whose SQL lives in a file the script itself vets read-only).
 */
function extractBashSql(command) {
  const cmd = String(command ?? "");

  if (!cmd.includes(SCRIPT)) return { skip: true }; // not our script → not our concern
  if (/--file\b/.test(cmd)) return { skip: true }; // file path; script self-enforces read-only

  const after = cmd.slice(cmd.indexOf(SCRIPT) + SCRIPT.length);
  // First single- or double-quoted argument after the script name = the SQL.
  const m = after.match(/"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/);

  if (!m) return { skip: true }; // no inline SQL found; let the script enforce

  // Undo shell escaping (\( \) \* \` \" …) so the SQL parses as written.
  return { statement: (m[1] ?? m[2] ?? "").replace(/\\(.)/g, "$1") };
}

(async () => {
  const raw = await readStdin();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Can't parse the hook payload → fail closed.
    return deny("could not parse tool input; blocked as a precaution");
  }

  const toolName = payload.tool_name ?? payload.toolName;
  const input = payload.tool_input ?? payload.toolInput ?? {};

  let statement;

  if (toolName === MCP_TOOL) {
    statement = input.statement;
  } else if (toolName === "Bash") {
    const res = extractBashSql(input.command);

    if (res.skip) return allow(); // not a query-databricks SQL invocation

    statement = res.statement;
  } else {
    return allow(); // not a Databricks surface
  }

  const problem = validate(statement);
  if (problem) return deny(`${problem}  — only read queries are permitted against Databricks.`);
  return allow();
})();
