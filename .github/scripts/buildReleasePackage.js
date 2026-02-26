#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const version = process.argv[2];
const artifactName = process.argv[3];
const target = process.argv[4] || "node18-win-x64";

const rootDir = process.cwd();
const packageName = `${artifactName}_${version}`;
const packageDir = path.join(rootDir, packageName);
const isWindowsTarget = target.includes("win");
const binaryName = `WebTextConverter_${version}${isWindowsTarget ? ".exe" : ""}`;
const binaryPath = path.join(packageDir, binaryName);
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wtc-build-"));
const buildDir = path.join(tempDir, "build");

// 发行目录：只放运行资源与 exe。
fs.rmSync(packageDir, { recursive: true, force: true });
fs.mkdirSync(packageDir, { recursive: true });
["static", "templates", "assets", "example"].forEach((dir) => {
  fs.cpSync(path.join(rootDir, dir), path.join(packageDir, dir), {
    recursive: true,
  });
});
[
  ["config.yaml", "config.yaml"],
  ["README.md", "README.md"],
  ["LICENSE", "LICENSE.txt"],
  ["favicon.ico", "favicon.ico"],
].forEach(([from, to]) => {
  fs.cpSync(path.join(rootDir, from), path.join(packageDir, to));
});

// 临时构建目录：只用于产出 exe，构建后会删除。
fs.mkdirSync(buildDir, { recursive: true });
fs.cpSync(path.join(rootDir, "backend"), path.join(buildDir, "backend"), {
  recursive: true,
});
fs.cpSync(path.join(rootDir, "package.json"), path.join(buildDir, "package.json"));
fs.cpSync(
  path.join(rootDir, "package-lock.json"),
  path.join(buildDir, "package-lock.json"),
);

// pkg 运行时从 exe 同级目录读取 config/static/templates。
const serverJsPath = path.join(buildDir, "backend", "server.js");
const serverCode = fs
  .readFileSync(serverJsPath, "utf8")
  .replace(
    'const projectRoot = path.resolve(__dirname, "..");',
    'const projectRoot = process.pkg ? path.dirname(process.execPath) : path.resolve(__dirname, "..");',
  );
fs.writeFileSync(serverJsPath, serverCode, "utf8");

execSync(`npm ci --omit=dev --prefix "${buildDir}"`, {
  cwd: rootDir,
  stdio: "inherit",
});

execSync(
  `npx --yes pkg . --targets "${target}" --output "${binaryPath}"`,
  { cwd: buildDir, stdio: "inherit" },
);

if (isWindowsTarget) {
  execSync(
    `npx --yes resedit-cli --icon 1,favicon.ico --in "${binaryPath}" --out "${binaryPath}"`,
    { cwd: packageDir, stdio: "inherit" },
  );
}

fs.rmSync(tempDir, { recursive: true, force: true });
