import * as vscode from 'vscode';
import * as rethinkdb from 'rethinkdb';
import { Serializer } from '../serialization/serializer';
import { Deserializer } from '../serialization/deserializer';
import { readFileSync } from 'fs';

export class RemoteDb {
  private host: string;
  private port: number;
  private username: string;
  private password: string;
  private database: string;
  private table: string;
  private ssl: string;
  private noteMap: Map<string, vscode.CommentThread>;
  private connection: any;

  public constructor(
    host: string,
    port: number,
    username: string,
    password: string,
    database: string,
    table: string,
    ssl: string,
    noteMap: Map<string, vscode.CommentThread>,
  ) {
    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
    this.database = database;
    this.table = table;
    this.ssl = ssl;
    this.noteMap = noteMap;

    this.connect();
  }

  public connect() {
    rethinkdb.connect(
      {
        host: this.host,
        port: this.port,
        db: this.database,
        user: this.username,
        password: this.password,
        ssl:
          this.ssl !== ''
            ? {
                ca: readFileSync(this.ssl).toString().trim(),
              }
            : undefined,
      },
      (err: Error, conn: any) => {
        if (err) {
          vscode.window.showErrorMessage(
            'An error has occurred while connecting to the remote DB: ' + err,
          );
          return;
        }
        vscode.window.showInformationMessage(
          'Connection to remote DB was established successfully.',
        );
        this.connection = conn;
        this.createDatabase();
      },
    );
  }

  public createDatabase() {
    rethinkdb
      .dbCreate(this.database)
      .run(this.connection, (err: Error, cursor: any) => {
        if (err && err.name !== 'ReqlOpFailedError') {
          vscode.window.showErrorMessage(
            'An error has occurred while creating DB: ' + err,
          );
          return;
        }

        if (cursor && cursor.dbs_created) {
          vscode.window.showInformationMessage('DB created successfully.');
        }

        this.createTable();
      });
  }

  public createTable() {
    rethinkdb
      .db(this.database)
      .tableCreate(this.table)
      .run(this.connection, (err: Error, cursor: any) => {
        if (err && err.name !== 'ReqlOpFailedError') {
          vscode.window.showErrorMessage(
            'An error has occurred while creating table: ' + err,
          );
          return;
        }

        if (cursor && cursor.tables_created) {
          vscode.window.showInformationMessage('Table created successfully.');
        }

        this.subscribe();
      });
  }

  public subscribe() {
    rethinkdb
      .db(this.database)
      .table(this.table)
      .changes()
      .run(this.connection, (err: Error, cursor: any) => {
        if (err) {
          vscode.window.showErrorMessage(
            'An error has occurred while subscribing to the remote DB:' + err,
          );
          return;
        }
        cursor.each((err: Error, row: any) => {
          if (err) {
            vscode.window.showErrorMessage(
              'An error has occurred while fetching from remote DB:' + err,
            );
            return;
          }
          this.noteMap.get(row.new_val.id)?.dispose();
          const newThread: vscode.CommentThread | undefined = Deserializer.deserializeThread(
            row.new_val,
          );
          if (newThread) {
            this.noteMap.set(
              newThread.contextValue ? newThread.contextValue : '',
              newThread,
            );
            vscode.window.showInformationMessage('Note received from remote DB.');
          }
        });
      });
  }

  public async retrieveAll(): Promise<vscode.CommentThread[]> {
    return rethinkdb
      .db(this.database)
      .table(this.table)
      .run(this.connection)
      .then((cursor) => {
        return cursor.toArray();
      })
      .then((output) => {
        const remoteSerializedThreads: any = [];
        output.forEach((remoteSerializedThread) => {
          remoteSerializedThreads.push(remoteSerializedThread);
        });
        return remoteSerializedThreads;
      });
  }

  public pushNoteComment(note: vscode.CommentThread, firstComment: boolean) {
    const st = JSON.parse(JSON.stringify(Serializer.serializeThread(note)));
    if (firstComment) {
      rethinkdb
        .db(this.database)
        .table(this.table)
        .insert(st)
        .run(this.connection, function (err, result) {
          if (err) {
            vscode.window.showErrorMessage(
              'An error has occurred while inserting to remote DB:' + err,
            );
            return;
          }
          if (result.inserted) {
            vscode.window.showInformationMessage(
              'Note was inserted successfully in remote DB.',
            );
          }
        });
    } else {
      rethinkdb
        .db(this.database)
        .table(this.table)
        .get(note.contextValue ? note.contextValue : '')
        .update(st)
        .run(this.connection, function (err, result) {
          if (err) {
            vscode.window.showErrorMessage(
              'An error has occurred while inserting to remote DB:' + err,
            );
            return;
          }
          if (result.inserted) {
            vscode.window.showInformationMessage(
              'Note was inserted successfully in remote DB.',
            );
          }
        });
    }
  }
}
