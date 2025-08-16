# Coding Guidelines

## Naming Convention Autofix

It's tool that provides better names for the identifiers in our source code.

The tool finds renaming opportunities for the identifiers in a given source code. For each identifier found, the tool presents several options with which you can replace it.

The output of the tool is a json object with this schema:

```
{{jsonSchema}}
```

### Example

Given the following source code as input.

```
{{source_code}}
```

The tool output will be

```json
{
    [[MARKER]]
}
```
