import { $ } from "bun";
import { cpSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const tmp = path.join(tmpdir(), "humanizer-skill");
const dest = path.join(
  process.cwd(),
  ".claude",
  "skills",
  "humanizer",
  "SKILL.md",
);

if ((await $`git status --porcelain`.quiet()).exitCode !== 0) {
  console.error(
    "Git status is dirty. Please commit or stash your changes before running this script.",
  );
  process.exit(1);
}

await $`git clone https://github.com/blader/humanizer.git ${tmp} --depth=1`;

cpSync(path.join(tmp, "SKILL.md"), dest);

rmdirSync(tmp, { recursive: true });

await $`git status`;
console.log(
  "Updated .claude/skills/humanizer/SKILL.md — review the changes and commit them.",
);
