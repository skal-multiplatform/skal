# skal skill — eval definitions

Test prompts + assertions for the agent skill that ships in the app
template (`scripts/templates/default/.claude/skills/skal/`). Kept out
of the template dir so `skal create` doesn't copy test scaffolding
into user apps. Used by the skill-creator eval loop (with-skill vs
baseline subagent runs, graded on build + idiom assertions).
