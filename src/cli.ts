#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { MergeError, merge } from "./merge.js";

const usage = `Usage: cddl-merge <main.cddl> <extension.cddl> [-o <output.cddl>]

Merges a main CDDL file with an extension CDDL file. Every rule in the
extension file must be a group named after a rule in the main file plus
"Extension"; each of those group names is added to the corresponding rule in
the main file.

Writes the merged CDDL to <output.cddl>, or to stdout if -o is not given.`;

function main(argv: string[]): number {
  const files: string[] = [];
  let output: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "-h" || arg === "--help") {
      console.log(usage);
      return 0;
    } else if (arg === "-o" || arg === "--output") {
      output = argv[++i];
      if (output === undefined) {
        return fail(`missing file name after ${arg}`);
      }
    } else if (arg.startsWith("-")) {
      return fail(`unknown option ${arg}`);
    } else {
      files.push(arg);
    }
  }

  if (files.length !== 2) {
    return fail(`expected 2 input files, got ${files.length}`);
  }
  const [mainFile, extensionFile] = files as [string, string];

  try {
    const merged = merge(read(mainFile), read(extensionFile), {
      mainName: basename(mainFile),
      extensionName: basename(extensionFile),
    });
    if (output === undefined) {
      process.stdout.write(merged);
    } else {
      writeFileSync(output, merged);
    }
  } catch (error) {
    if (error instanceof MergeError) {
      console.error(error.message);
      return 1;
    }
    console.error(`cddl-merge: ${(error as Error).message}`);
    return 1;
  }
  return 0;
}

function read(file: string): string {
  return readFileSync(file, "utf8");
}

function fail(message: string): number {
  console.error(`cddl-merge: ${message}\n\n${usage}`);
  return 2;
}

process.exitCode = main(process.argv.slice(2));
