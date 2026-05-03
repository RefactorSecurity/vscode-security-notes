const Module = require('node:module');
const path = require('node:path');

const workspaceRoot = path.resolve(__dirname, '../..');
const originalLoad = Module._load;
let installed = false;
const configuration = {};

class Position {
  constructor(line, character) {
    this.line = line;
    this.character = character;
  }
}

class Range {
  constructor(startLine, startCharacter, endLine, endCharacter) {
    this.start = new Position(startLine, startCharacter);
    this.end = new Position(endLine, endCharacter);
  }
}

class Uri {
  constructor(fsPath) {
    this.fsPath = fsPath;
  }

  static file(fsPath) {
    return new Uri(fsPath);
  }

  static parse(value) {
    return new Uri(value);
  }

  static joinPath(baseUri, ...paths) {
    return new Uri(path.join(baseUri.fsPath, ...paths));
  }

  toString() {
    return this.fsPath;
  }
}

const createCommentController = () => ({
  createCommentThread: (uri, range, comments) => ({
    uri,
    range,
    comments,
    dispose: () => {},
  }),
  dispose: () => {},
});

class EventEmitter {
  constructor() {
    this.listeners = new Set();
    this.event = (listener) => {
      this.listeners.add(listener);
      return {
        dispose: () => {
          this.listeners.delete(listener);
        },
      };
    };
  }

  fire(value) {
    this.listeners.forEach((listener) => listener(value));
  }

  dispose() {
    this.listeners.clear();
  }
}

const vscode = {
  CommentMode: {
    Preview: 0,
    Editing: 1,
  },
  EventEmitter,
  Range,
  Uri,
  comments: {
    createCommentController,
  },
  workspace: {
    workspaceFolders: [{ uri: Uri.file(workspaceRoot) }],
    getConfiguration: () => ({
      get: (settingName, defaultValue) => (
        Object.prototype.hasOwnProperty.call(configuration, settingName)
          ? configuration[settingName]
          : defaultValue
      ),
    }),
  },
  window: {
    showErrorMessage: () => Promise.resolve(undefined),
    showInformationMessage: () => Promise.resolve(undefined),
    showWarningMessage: () => Promise.resolve(undefined),
  },
};

const setConfiguration = (settingName, value) => {
  configuration[settingName] = value;
};

const resetConfiguration = () => {
  Object.keys(configuration).forEach((settingName) => {
    delete configuration[settingName];
  });
};

const installVsCodeMock = () => {
  if (installed) {
    return;
  }

  Module._load = function mockVsCode(request, parent, isMain) {
    if (request === 'vscode') {
      return vscode;
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  installed = true;
};

module.exports = {
  installVsCodeMock,
  Position,
  Range,
  Uri,
  resetConfiguration,
  setConfiguration,
  vscode,
  workspaceRoot,
};
