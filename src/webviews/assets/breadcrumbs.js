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
      list.appendChild(renderCrumb(crumb, index === trail.crumbs.length - 1, trail.id));
    });

    content.appendChild(list);
  }

  function renderCrumb(crumb, isLast, trailId) {
    const item = document.createElement('div');
    item.className = `crumb-item${isLast ? ' crumb-item--last' : ''}`;
    item.dataset.crumbId = crumb.id;
    item.dataset.trailId = trailId;

    const marker = document.createElement('div');
    marker.className = 'crumb-item__marker';
    const markerLabel = document.createElement('span');
    markerLabel.textContent = String(crumb.index + 1);
    marker.appendChild(markerLabel);
    item.appendChild(marker);

    const body = document.createElement('div');
    body.className = 'crumb-item__body';

    const header = document.createElement('div');
    header.className = 'crumb-item__header';
    const path = document.createElement('span');
    path.className = 'crumb-item__path';
    path.textContent = `${crumb.filePath}:${crumb.rangeLabel}`;
    header.appendChild(path);
    body.appendChild(header);

    if (crumb.note) {
      const note = document.createElement('p');
      note.className = 'crumb-item__note';
      note.textContent = crumb.note;
      body.appendChild(note);
    }

    const snippet = document.createElement('pre');
    snippet.className = 'crumb-item__snippet';
    snippet.textContent = crumb.snippet;
    body.appendChild(snippet);

    const meta = document.createElement('p');
    meta.className = 'crumb-item__meta';
    const created = new Date(crumb.createdAt).toLocaleString();
    meta.textContent = `Captured ${created}`;
    body.appendChild(meta);

    body.addEventListener('click', () => {
      vscode.postMessage({ type: 'openCrumb', trailId, crumbId: crumb.id });
    });

    item.appendChild(body);

    return item;
  }

  vscode.postMessage({ type: 'ready' });
})();
