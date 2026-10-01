// Pinned sbt launcher; no global Scala/sbt install is required (JDK 17+ is).
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const version = '1.10.7';
const checksum = '3cca02818047327a83efde776103a1ef92f76f72c062badbbb062499a3270c07';
const root = new URL('../', import.meta.url);
const directory = new URL('target/tooling/', root);
const launcher = new URL(`sbt-launch-${version}.jar`, directory);
await mkdir(directory, { recursive: true });
let bytes;
try {
  bytes = await readFile(launcher);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (!bytes || createHash('sha256').update(bytes).digest('hex') !== checksum) {
  const response = await fetch(
    `https://repo.maven.apache.org/maven2/org/scala-sbt/sbt-launch/${version}/sbt-launch-${version}.jar`,
    { signal: AbortSignal.timeout(120000) },
  );
  if (!response.ok) throw new Error(`sbt launcher download: ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== checksum)
    throw new Error('sbt launcher checksum mismatch');
  await writeFile(launcher, bytes);
}
const { fileURLToPath } = await import('node:url');
const tasks = process.argv.slice(2).filter((arg) => arg !== '--');
if (!tasks.length) throw new Error('Supply sbt tasks, e.g. compile, test, fullLinkJS');
const child = spawn(
  'java',
  [
    '-XX:ActiveProcessorCount=4',
    '-Dsbt.server.forcestart=true',
    '-Dsbt.server.autostart=false',
    '-Dsbt.override.build.repos=true',
    `-Dsbt.repository.config=${fileURLToPath(new URL('project/repositories', root))}`,
    '-Dsbt.supershell=false',
    '-jar',
    fileURLToPath(launcher),
    ...tasks,
  ],
  { cwd: fileURLToPath(root), stdio: 'inherit' },
);
child.on('error', (error) => {
  console.error('Cannot start Scala build; install JDK 17 or newer.', error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
