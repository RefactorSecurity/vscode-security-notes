'use strict';

import * as vscode from 'vscode';

export const getNonce = () => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

export const getWebviewContentSecurityPolicy = (
  webview: vscode.Webview,
  nonce: string,
) => [
  "default-src 'none'",
  `img-src ${webview.cspSource} data:`,
  `style-src ${webview.cspSource}`,
  `script-src 'nonce-${nonce}'`,
].join('; ');
