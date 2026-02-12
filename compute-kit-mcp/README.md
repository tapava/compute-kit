# ComputeKit MCP Server — VS Code Extension

Provides the [ComputeKit](https://github.com/tapava/compute-kit) documentation as an MCP (Model Context Protocol) server for AI assistants in VS Code (GitHub Copilot, etc.).

## What it does

Once installed, this extension registers the ComputeKit documentation MCP server so that AI tools in VS Code can automatically access ComputeKit's API reference, examples, and guides when answering your questions.

The MCP server is powered by [GitMCP](https://gitmcp.io/tapava/compute-kit).

## Features

- **Zero configuration** — install the extension and the MCP server is available immediately
- **Always up-to-date** — documentation is fetched live from the repository
- **Works with GitHub Copilot** — ask Copilot about ComputeKit and it will have full context

## Topics covered

- Web Worker pool setup and usage
- React hooks (`useCompute`, `useComputeQuery`)
- WebAssembly (WASM) module loading
- Typed function registry
- Pipeline API for chaining computations
- Performance tips and debugging

## Requirements

- VS Code 1.99 or later
- GitHub Copilot or another AI assistant that supports MCP

## Links

- [ComputeKit Documentation](https://tapava.github.io/compute-kit)
- [GitHub Repository](https://github.com/tapava/compute-kit)
- [Live Demo](https://computekit-demo.vercel.app/)
