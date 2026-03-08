use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct SkillMetadata {
    pub name: String,
    pub description: String,
    pub path: String,
}

pub fn render_skills_section(skills: &[SkillMetadata]) -> Option<String> {
    if skills.is_empty() {
        return None;
    }

    let mut lines = Vec::new();
    lines.push("## Skills".to_string());
    lines.push("A skill is a set of local instructions to follow that is stored in a `SKILL.md` file. Below is the list of skills that can be used. Each entry includes a name, description, and file path so you can open the source for full instructions when using a specific skill.".to_string());
    lines.push("### Available skills".to_string());
    for skill in skills {
        lines.push(format!("- {}: {} (file: {})", skill.name, skill.description, skill.path));
    }
    lines.push("### How to use skills".to_string());
    lines.push("- Discovery: The list above is the skills available in this session (name + description + file path). Skill bodies live on disk at the listed paths.".to_string());
    lines.push("- Trigger rules: If the user names a skill or the task clearly matches a skill description, you must use that skill for that turn.".to_string());
    Some(lines.join("\n"))
}
