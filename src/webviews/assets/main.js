/* eslint-disable no-undef */

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
  const vscode = acquireVsCodeApi();

  document
    .querySelector('.process-file-button')
    .addEventListener('click', () => onButtonClicked());

  function onButtonClicked() {
    let toolSelect = document.getElementById('toolSelect');
    let toolName = toolSelect.options[toolSelect.selectedIndex].value;

    let selectedFile = document.getElementById('fileInput').files[0];
    readFile(selectedFile).then((fileContent) => {
      vscode.postMessage({ type: 'processToolFile', toolName, fileContent }),
        (document.getElementById('fileInput').value = '');
    });
  }

  async function readFile(file) {
    let fileContent = await new Promise((resolve) => {
      let fileReader = new FileReader();
      fileReader.onload = (e) => resolve(fileReader.result);
      fileReader.readAsText(file);
    });

    return fileContent;
  }
})();
