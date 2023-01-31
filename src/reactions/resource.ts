'use strict';

import * as vscode from 'vscode';
import * as path from 'path';

export class Resource {
  static icons: any;

  static initialize(context: vscode.ExtensionContext) {
    Resource.icons = {
      reactions: {
        THUMBS_UP: context.asAbsolutePath(
          path.join('resources', 'reactions', 'thumbs_up.png'),
        ),
        THUMBS_DOWN: context.asAbsolutePath(
          path.join('resources', 'reactions', 'thumbs_down.png'),
        ),
        CONFUSED: context.asAbsolutePath(
          path.join('resources', 'reactions', 'confused.png'),
        ),
        EYES: context.asAbsolutePath(path.join('resources', 'reactions', 'eyes.png')),
        HEART: context.asAbsolutePath(path.join('resources', 'reactions', 'heart.png')),
        HOORAY: context.asAbsolutePath(
          path.join('resources', 'reactions', 'hooray.png'),
        ),
        LAUGH: context.asAbsolutePath(path.join('resources', 'reactions', 'laugh.png')),
        ROCKET: context.asAbsolutePath(
          path.join('resources', 'reactions', 'rocket.png'),
        ),
      },
    };
  }
}

export function getReactionGroup(): {
  title: string;
  label: string;
  icon: vscode.Uri;
}[] {
  const ret = [
    {
      title: 'CONFUSED',
      label: '😕',
      icon: Resource.icons.reactions.CONFUSED,
    },
    {
      title: 'EYES',
      label: '👀',
      icon: Resource.icons.reactions.EYES,
    },
    {
      title: 'HEART',
      label: '❤️',
      icon: Resource.icons.reactions.HEART,
    },
    {
      title: 'HOORAY',
      label: '🎉',
      icon: Resource.icons.reactions.HOORAY,
    },
    {
      title: 'LAUGH',
      label: '😄',
      icon: Resource.icons.reactions.LAUGH,
    },
    {
      title: 'ROCKET',
      label: '🚀',
      icon: Resource.icons.reactions.ROCKET,
    },
    {
      title: 'THUMBS_DOWN',
      label: '👎',
      icon: Resource.icons.reactions.THUMBS_DOWN,
    },
    {
      title: 'THUMBS_UP',
      label: '👍',
      icon: Resource.icons.reactions.THUMBS_UP,
    },
  ];

  return ret;
}
