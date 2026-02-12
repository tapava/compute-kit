import * as vscode from 'vscode';

const MCP_SERVER_URL = 'https://gitmcp.io/tapava/compute-kit';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider('computekit-docs', {
      provideMcpServerDefinitions: async () => {
        return [
          new vscode.McpHttpServerDefinition(
            'ComputeKit Docs',
            vscode.Uri.parse(MCP_SERVER_URL)
          ),
        ];
      },
    })
  );
}

export function deactivate() {}
