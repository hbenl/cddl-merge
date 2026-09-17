# cddl-merge

Merges a main CDDL file with an extension CDDL file.

A rule in the extension file whose name ends with `Extension` must be a group
whose name is the name of a rule in the main file followed by `Extension`. Each
of those group names is added as an entry to the corresponding rule in the main
file, so that the merged CDDL is the main file extended by the extension groups,
followed by the unmodified extension file.

The extension file may also define other rules, whose name does not end with
`Extension`. Those are carried over unchanged, which is useful for helper types
that the extension groups refer to.

Given a main file

```cddl
browsingContext.Info = {
  context: browsingContext.BrowsingContext,
  url: text,
}
```

and an extension file

```cddl
browsingContext.InfoExtension = (
  ? "moz:scope": "chrome" / "content",
)
```

the merged result is

```cddl
browsingContext.Info = {
  context: browsingContext.BrowsingContext,
  url: text,
  browsingContext.InfoExtension
}

browsingContext.InfoExtension = (
  ? "moz:scope": "chrome" / "content",
)
```

Comments, whitespace and the indentation of the extended rule are preserved.

## Usage

```bash
npm install
npm run build
node dist/cli.js <main.cddl> <extension.cddl> [-o <output.cddl>]
```

Without `-o`, the merged CDDL is written to stdout. On success the exit code is
0; if the files cannot be merged, all problems are reported on stderr and the
exit code is 1.

```bash
node dist/cli.js example/main.cddl example/extension.cddl -o merged.cddl
```

The merge is also available as a library:

```js
import { merge, MergeError } from "cddl-merge";

const merged = merge(mainSource, extensionSource); // throws MergeError
```

A rule of the main file can only be extended if it defines a map (`{ ... }`) or
a group (`( ... )`) with a single group choice. Type choices, arrays and choices
between several groups are reported as errors rather than extended, as is a rule
whose name ends with `Extension` but that has no matching rule in the main file.

## Tests

```bash
npm test
```
