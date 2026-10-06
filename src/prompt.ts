import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export type MenuOption = {
  value: string;
  label: string;
};

export async function ask(question: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({ input, output });

  try {
    const hint = defaultValue ? ` (${defaultValue})` : "";
    const answer = (await rl.question(`${question}${hint}: `)).trim();
    return answer || defaultValue || "";
  } finally {
    rl.close();
  }
}

export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? "Y/n" : "y/N";
  const answer = (await ask(`${question} [${hint}]`)).toLowerCase();

  if (!answer) return defaultYes;
  return answer === "y" || answer === "yes";
}

export async function chooseMenu(title: string, options: MenuOption[]): Promise<string> {
  console.log("");
  console.log("========================================");
  console.log(`  ${title}`);
  console.log("========================================");

  for (let i = 0; i < options.length; i++) {
    console.log(`  ${i + 1}) ${options[i]!.label}`);
  }

  console.log("");

  while (true) {
    const raw = await ask("Enter number", "1");
    const num = Number.parseInt(raw, 10);

    if (Number.isFinite(num) && num >= 1 && num <= options.length) {
      return options[num - 1]!.value;
    }

    console.log("Invalid choice. Enter a number from the list.");
  }
}

export async function chooseMany(
  title: string,
  options: MenuOption[],
  defaultAll = false
): Promise<string[]> {
  console.log("");
  console.log(title);
  for (let i = 0; i < options.length; i++) {
    console.log(`  ${i + 1}) ${options[i]!.label}`);
  }
  console.log("");
  console.log("Enter comma-separated numbers (e.g. 1,3), or 'all', or 'none'.");

  const defaultHint = defaultAll ? "all" : "";
  const raw = (await ask("Selection", defaultHint)).toLowerCase().trim();

  if (!raw && defaultAll) {
    return options.map((o) => o.value);
  }

  if (raw === "all") {
    return options.map((o) => o.value);
  }

  if (raw === "none" || raw === "") {
    return [];
  }

  const nums = raw
    .split(/[,;\s]+/)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isFinite(n));

  const picked = new Set<string>();
  for (const num of nums) {
    if (num >= 1 && num <= options.length) {
      picked.add(options[num - 1]!.value);
    }
  }

  return [...picked];
}

export async function askModuleKey(
  knownModules: string[],
  prompt = "Module name (e.g. products, admin/users)"
): Promise<string> {
  if (knownModules.length > 0) {
    console.log("");
    console.log("Existing modules:");
    for (const key of knownModules) {
      console.log(`   • ${key}`);
    }
    console.log("");
  }

  while (true) {
    const value = await ask(prompt);
    if (value) return value;
    console.log("Module name is required.");
  }
}
