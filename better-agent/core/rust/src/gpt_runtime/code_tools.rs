use serde_json::{json, Value};

pub fn build_js_repl_tool() -> Value {
    const JS_REPL_FREEFORM_GRAMMAR: &str = r#"
start: pragma_source | plain_source

pragma_source: PRAGMA_LINE NEWLINE js_source
plain_source: PLAIN_JS_SOURCE

js_source: JS_SOURCE

PRAGMA_LINE: /[ \t]*\/\/ codex-js-repl:[^\r\n]*/
NEWLINE: /\r?\n/
PLAIN_JS_SOURCE: /(?:\s*)(?:[^\s{\"`]|`[^`]|``[^`])[\s\S]*/
JS_SOURCE: /(?:\s*)(?:[^\s{\"`]|`[^`]|``[^`])[\s\S]*/
"#;

    json!({
        "type": "custom",
        "name": "js_repl",
        "description": "Runs JavaScript in a persistent Node kernel with top-level await. This is a freeform tool: send raw JavaScript source text, optionally with a first-line pragma like `// codex-js-repl: timeout_ms=15000`; do not send JSON/quotes/markdown fences.",
        "format": {
            "type": "grammar",
            "syntax": "lark",
            "definition": JS_REPL_FREEFORM_GRAMMAR
        }
    })
}

pub fn build_artifacts_tool() -> Value {
    const ARTIFACTS_FREEFORM_GRAMMAR: &str = r#"
start: pragma_source | plain_source

pragma_source: PRAGMA_LINE NEWLINE js_source
plain_source: PLAIN_JS_SOURCE

js_source: JS_SOURCE

PRAGMA_LINE: /[ \t]*\/\/ codex-artifacts:[^\r\n]*/ | /[ \t]*\/\/ codex-artifact-tool:[^\r\n]*/
NEWLINE: /\r?\n/
PLAIN_JS_SOURCE: /(?:\s*)(?:[^\s{\"`]|`[^`]|``[^`])[\s\S]*/
JS_SOURCE: /(?:\s*)(?:[^\s{\"`]|`[^`]|``[^`])[\s\S]*/
"#;

    json!({
        "type": "custom",
        "name": "artifacts",
        "description": "Runs raw JavaScript against the preinstalled Codex @oai/artifact-tool runtime for creating presentations or spreadsheets.",
        "format": {
            "type": "grammar",
            "syntax": "lark",
            "definition": ARTIFACTS_FREEFORM_GRAMMAR
        }
    })
}
