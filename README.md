# Security Notes

Security Notes is a Visual Studio Code extension to aid code reviews from a security perspective. 

The extension allows the creation of notes within source files, which can be replied to, reacted to using emojis, and assigned statuses such as "TODO", "Vulnerable" and "Not Vulnerable". 

Also, it allows importing the output from SAST tools (currently only [Semgrep](https://semgrep.dev/)) into notes, making the processing of the findings much easier.

## Installing a Release

Download the [latest release](https://github.com/RefactorSecurity/vscode-security-notes/releases) file (with the `.vsix` extension) and install manually in VSCode via **Extensions** > **Install From VSIX**.
## Building the Extension

- Run `npm install` in terminal to install dependencies
- Run the `Run Extension` target in the Debug View. This will:
  - Start a task `npm: watch` to compile the code
  - Run the extension in a new VS Code window

## Contributing

We welcome contributions to Security Notes! These are the many ways you can help:

- Report bugs
- Submit patches and features
- Add support for additional SAST tool output parsing
- Follow us on [Twitter](https://twitter.com/refactorsec) :) 

## Acknowledgments

This project is based on the [comment-sample](https://github.com/microsoft/vscode-extension-samples/tree/main/comment-sample) extension. 

Additionally, the code for the note reactions was inspired by [comment-reactions](https://github.com/hacke2/vscode-extension-samples/tree/feat/comment-reactions).

## License

MIT