use serde_json::{json, Value};

pub fn build_view_image_tool() -> Value {
    json!({
        "type": "function",
        "name": "view_image",
        "description": "View a local image from the filesystem (only use if given a full filepath by the user, and the image isn't already attached to the thread context within <image ...> tags).",
        "strict": false,
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Local filesystem path to an image file"
                }
            },
            "required": ["path"],
            "additionalProperties": false
        }
    })
}
