const { spawnSync } = require("node:child_process");

const action = process.argv[2];
const argv = process.argv.slice(3);

const readArg = (name) => {
  const prefix = `--${name}=`;
  const entry = argv.find((arg) => arg.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : undefined;
};

const stripKnownArgs = (args) => {
  return args.filter(
    (arg) =>
      !arg.startsWith("--variant=") &&
      !arg.startsWith("--platform=") &&
      !arg.startsWith("--artifact="),
  );
};

const variant = readArg("variant") || process.env.npm_config_variant;
const platform = readArg("platform") || process.env.npm_config_platform || "android";
const artifact = readArg("artifact") || process.env.npm_config_artifact;
const passthroughArgs = stripKnownArgs(argv);

if (!variant) {
  console.error(
    "Missing game variant. Use --variant=<game-id> (for example: --variant=snake).",
  );
  process.exit(1);
}

const env = {
  ...process.env,
  APP_VARIANT: variant,
  EXPO_PUBLIC_APP_VARIANT: variant,
};

const run = (bin, args) => {
  const result = spawnSync(bin, args, { stdio: "inherit", env });
  process.exit(result.status ?? 1);
};

if (action === "start") {
  run("npx", ["expo", "start", ...passthroughArgs]);
}

const runEasBuild = ({ profileSuffix, targetPlatform, local = false }) => {
  const profile = `${variant}-${profileSuffix}`;
  const localArgs = local ? ["--local"] : [];
  run("npx", [
    "--yes",
    "eas-cli",
    "build",
    "--profile",
    profile,
    "--platform",
    targetPlatform,
    ...localArgs,
    ...passthroughArgs,
  ]);
};

if (action === "preview" || action === "build") {
  const suffix = action === "preview" ? "preview" : "production";
  runEasBuild({
    profileSuffix: suffix,
    targetPlatform: platform,
  });
}

if (action === "local-build") {
  if (!artifact) {
    console.error(
      "Missing artifact type. Use --artifact=ipa, --artifact=apk, or --artifact=aab.",
    );
    process.exit(1);
  }

  if (artifact === "ipa") {
    runEasBuild({
      profileSuffix: "preview",
      targetPlatform: "ios",
      local: true,
    });
  }

  if (artifact === "apk") {
    runEasBuild({
      profileSuffix: "preview",
      targetPlatform: "android",
      local: true,
    });
  }

  if (artifact === "aab") {
    runEasBuild({
      profileSuffix: "production",
      targetPlatform: "android",
      local: true,
    });
  }

  console.error(
    `Unsupported artifact "${artifact}". Use one of: ipa, apk, aab.`,
  );
  process.exit(1);
}

console.error(
  `Unsupported action "${action}". Use one of: start, preview, build, local-build.`,
);
process.exit(1);
