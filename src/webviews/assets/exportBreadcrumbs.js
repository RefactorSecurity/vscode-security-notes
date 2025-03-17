// @ts-check

(function () {
  // Get the VS Code API
  const vscode = acquireVsCodeApi();

  // Wait for the DOM to load
  document.addEventListener('DOMContentLoaded', function () {
    // Get export button and add click event
    const exportButton = document.querySelector('.export-breadcrumbs-button');
    if (exportButton) {
      exportButton.addEventListener('click', exportBreadcrumbs);
    }
  });
  
  /**
   * Export the selected breadcrumbs
   */
  function exportBreadcrumbs() {
    // Get all checked breadcrumb checkboxes
    const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
    const breadcrumbIds = Array.from(checkboxes).map(checkbox => checkbox.value);
    
    // Get the selected format
    const formatSelect = document.getElementById('format-select');
    const format = formatSelect ? formatSelect.value : 'html';
    
    // Send the export message to the extension
    vscode.postMessage({
      type: 'exportBreadcrumbs',
      breadcrumbIds: breadcrumbIds,
      format: format
    });
  }
}());