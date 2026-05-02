/* eslint-disable no-undef */

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
  const vscode = acquireVsCodeApi();

  document
    .querySelector('.process-file-button')
    .addEventListener('click', () => onButtonClicked());

  function onButtonClicked() {
    const toolSelect = document.getElementById('toolSelect');
    const toolName = toolSelect.options[toolSelect.selectedIndex].value;
    const fileInput = document.getElementById('fileInput');
    const selectedFile = fileInput.files[0];

    if (!selectedFile) {
      vscode.postMessage({
        type: 'importError',
        message: 'Select a results file before importing.',
      });
      return;
    }

    readFile(selectedFile)
      .then((fileContent) => {
        vscode.postMessage({ type: 'processToolFile', toolName, fileContent });
        fileInput.value = '';
      })
      .catch((error) => {
        vscode.postMessage({
          type: 'importError',
          message: `Failed to read selected file: ${error.message || error}`,
        });
      });
  }

  async function readFile(file) {
    const fileContent = await new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = (e) => resolve(fileReader.result);
      fileReader.onerror = () => reject(fileReader.error);
      fileReader.readAsText(file);
    });

    return fileContent;
  }
})();
