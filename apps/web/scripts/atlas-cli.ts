import { checkAtlases, writeAtlases } from "./atlas-packer";

// `npm run atlas -w apps/web` writes the atlases; with `--check` it only compares them with what the strips produce.
if (process.argv.includes("--check")) {
  const problems = checkAtlases();
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) process.exit(1);
  console.log("The hangar atlases match the strips.");
} else {
  writeAtlases();
  console.log("Wrote the hangar atlases.");
}
