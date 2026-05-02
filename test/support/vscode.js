const Module = require('node:module');
const path = require('node:path');

const workspaceRoot = path.resolve(__dirname, '../..');
const originalLoad = Module._load;
let installed = false;

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

const vscode = {
  CommentMode: {
    Preview: 0,
    Editing: 1,
  },
  Range,
  Uri,
  comments: {
    createCommentController,
  },
  workspace: {
    workspaceFolders: [{ uri: Uri.file(workspaceRoot) }],
    getConfiguration: () => ({
      get: (_settingName, defaultValue) => defaultValue,
    }),
  },
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
  vscode,
  workspaceRoot,
};
