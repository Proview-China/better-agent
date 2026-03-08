use serde_json::{json, Value};

pub fn build_list_mcp_resources_tool() -> Value {
    json!({
        "type": "function",
        "name": "list_mcp_resources",
        "description": "Lists resources provided by MCP servers. Resources allow servers to share data that provides context to language models, such as files, database schemas, or application-specific information. Prefer resources over web search when possible.",
        "strict": false,
        "parameters": {
            "type": "object",
            "properties": {
                "server": {
                    "type": "string",
                    "description": "Optional MCP server name. When omitted, lists resources from every configured server."
                },
                "cursor": {
                    "type": "string",
                    "description": "Opaque cursor returned by a previous list_mcp_resources call for the same server."
                }
            },
            "additionalProperties": false
        }
    })
}

pub fn build_list_mcp_resource_templates_tool() -> Value {
    json!({
        "type": "function",
        "name": "list_mcp_resource_templates",
        "description": "Lists resource templates provided by MCP servers. Parameterized resource templates allow servers to share data that takes parameters and provides context to language models, such as files, database schemas, or application-specific information. Prefer resource templates over web search when possible.",
        "strict": false,
        "parameters": {
            "type": "object",
            "properties": {
                "server": {
                    "type": "string",
                    "description": "Optional MCP server name. When omitted, lists resource templates from all configured servers."
                },
                "cursor": {
                    "type": "string",
                    "description": "Opaque cursor returned by a previous list_mcp_resource_templates call for the same server."
                }
            },
            "additionalProperties": false
        }
    })
}

pub fn build_read_mcp_resource_tool() -> Value {
    json!({
        "type": "function",
        "name": "read_mcp_resource",
        "description": "Read a specific resource from an MCP server given the server name and resource URI.",
        "strict": false,
        "parameters": {
            "type": "object",
            "properties": {
                "server": {
                    "type": "string",
                    "description": "MCP server name exactly as configured. Must match the server field returned by list_mcp_resources."
                },
                "uri": {
                    "type": "string",
                    "description": "Resource URI to read. Must be one of the URIs returned by list_mcp_resources."
                }
            },
            "required": ["server", "uri"],
            "additionalProperties": false
        }
    })
}
