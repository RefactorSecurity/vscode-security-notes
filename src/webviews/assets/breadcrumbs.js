/* eslint-disable no-undef */

(function () {
  const vscode = acquireVsCodeApi();

  const trailSelect = document.getElementById('trail-select');
  const content = document.getElementById('breadcrumbs-content');
  const createButton = document.querySelector('[data-action="create"]');
  const addButton = document.querySelector('[data-action="add"]');
  const exportButton = document.querySelector('[data-action="export"]');

  let currentState;

  window.addEventListener('message', (event) => {
    const { type, payload } = event.data;
    if (type === 'state') {
      currentState = payload;
      renderState(payload);
    }
  });

  trailSelect.addEventListener('change', (event) => {
    if (!currentState) {
      return;
    }
    const selectedTrailId = event.target.value;
    if (!selectedTrailId) {
      return;
    }
    if (selectedTrailId === currentState.activeTrailId) {
      return;
    }
    vscode.postMessage({ type: 'setActiveTrail', trailId: selectedTrailId });
  });

  createButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'createTrail' });
  });

  addButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'addCrumb' });
  });

  exportButton.addEventListener('click', () => {
    vscode.postMessage({ type: 'exportTrail' });
  });

  function renderState(state) {
    populateTrailSelect(state);

    if (!state.trails.length) {
      renderEmpty('Create a trail to start visualising your breadcrumbs.');
      return;
    }

    if (!state.activeTrail) {
      renderEmpty('Select a trail from the dropdown to view its breadcrumbs.');
      return;
    }

    renderTrail(state.activeTrail);
  }

  function populateTrailSelect(state) {
    trailSelect.innerHTML = '';

    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = state.trails.length ? 'Select a trail' : 'No trails yet';
    placeholderOption.disabled = true;
    placeholderOption.hidden = true;
    trailSelect.appendChild(placeholderOption);

    state.trails.forEach((trail) => {
      const option = document.createElement('option');
      option.value = trail.id;
      option.textContent = `${trail.name} (${trail.crumbCount})`;
      if (trail.id === state.activeTrailId) {
        option.selected = true;
      }
      trailSelect.appendChild(option);
    });

    if (state.activeTrailId) {
      trailSelect.value = state.activeTrailId;
    } else if (state.activeTrail) {
      trailSelect.value = state.activeTrail.id;
    } else {
      trailSelect.value = '';
    }
  }

  function renderEmpty(message) {
    content.innerHTML = '';
    const empty = document.createElement('p');
    empty.className = 'breadcrumbs-empty';
    empty.textContent = message;
    content.appendChild(empty);
  }

  function renderTrail(trail) {
    content.innerHTML = '';

    const summary = document.createElement('div');
    summary.className = 'breadcrumbs-summary';

    const title = document.createElement('h3');
    title.textContent = trail.name;
    summary.appendChild(title);

    const meta = document.createElement('p');
    const crumbLabel = trail.crumbs.length === 1 ? 'crumb' : 'crumbs';
    const details = [];
    details.push(`${trail.crumbs.length} ${crumbLabel}`);
    if (trail.description) {
      details.push(trail.description);
    }
    meta.textContent = details.join(' · ');
    summary.appendChild(meta);

    content.appendChild(summary);

    if (!trail.crumbs.length) {
      renderEmpty('This trail does not have any crumbs yet. Add one to build your diagram.');
      return;
    }

    const list = document.createElement('div');
    list.className = 'crumb-list';

    trail.crumbs.forEach((crumb, index) => {
      list.appendChild(renderCrumb(crumb, index, trail.id));
    });

    content.appendChild(list);
  }

  function renderCrumb(crumb, index, trailId) {
    const details = document.createElement('details');
    details.className = 'crumb-item';
    details.dataset.crumbId = crumb.id;
    details.dataset.trailId = trailId;
    if (index === 0) {
      details.open = true;
    }

    const summary = document.createElement('summary');
    summary.className = 'crumb-summary';

    const summaryMeta = document.createElement('div');
    summaryMeta.className = 'crumb-summary__meta';

    const step = document.createElement('span');
    step.className = 'crumb-step';
    step.textContent = `Step ${index + 1}`;
    summaryMeta.appendChild(step);

    const title = document.createElement('span');
    title.className = 'crumb-title';
    title.textContent = `${crumb.filePath}:${crumb.rangeLabel}`;
    summaryMeta.appendChild(title);

    summary.appendChild(summaryMeta);

    const preview = document.createElement('span');
    preview.className = 'crumb-preview';
    preview.textContent = crumb.note || crumb.snippetPreview || '(no preview)';
    summary.appendChild(preview);

    const chevron = document.createElement('span');
    chevron.className = 'crumb-chevron';
    chevron.innerHTML = '▾';
    summary.appendChild(chevron);

    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'crumb-body';

    const meta = document.createElement('p');
    meta.className = 'crumb-meta';
    const created = new Date(crumb.createdAt).toLocaleString();
    meta.textContent = `Captured ${created}`;
    body.appendChild(meta);

    if (crumb.note) {
      const note = document.createElement('p');
      note.className = 'crumb-note';
      note.textContent = crumb.note;
      body.appendChild(note);
    }

    const snippet = document.createElement('pre');
    snippet.className = 'crumb-snippet';
    snippet.textContent = crumb.snippet;
    snippet.addEventListener('click', (event) => {
      event.stopPropagation();
      vscode.postMessage({ type: 'openCrumb', trailId, crumbId: crumb.id });
    });
    body.appendChild(snippet);

    details.addEventListener('toggle', () => {
      if (details.open) {
        chevron.innerHTML = '▾';
      } else {
        chevron.innerHTML = '▸';
      }
    });

    chevron.innerHTML = details.open ? '▾' : '▸';
    details.appendChild(body);

    return details;
  }

  vscode.postMessage({ type: 'ready' });
})();
