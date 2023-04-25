/* eslint-disable no-undef */

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
  const vscode = acquireVsCodeApi();

  document
    .querySelector('.export-notes-button')
    .addEventListener('click', () => onButtonClicked());

  function onButtonClicked() {
    // selected notes
    let vulnerable = document.getElementById('vulnerable-notes').checked;
    let notVulnerable = document.getElementById('not-vulnerable-notes').checked;
    let todo = document.getElementById('todo-notes').checked;
    let noStatus = document.getElementById('no-status-notes').checked;
    let status = {
      vulnerable,
      notVulnerable,
      todo,
      noStatus,
    };

    // additional options
    let includeCodeSnippet = document.getElementById('include-code-snippet').checked;
    let includeReplies = document.getElementById('include-note-replies').checked;
    let includeAuthors = document.getElementById('include-authors').checked;
    let options = {
      includeCodeSnippet,
      includeReplies,
      includeAuthors,
    };

    // export format
    let formatSelect = document.getElementById('format-select');
    let format = formatSelect.options[formatSelect.selectedIndex].value;

    vscode.postMessage({ type: 'exportNotes', status, options, format });
  }
})();
