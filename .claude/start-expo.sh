#!/bin/bash
export PATH="/Users/aswinraj/.nvm/versions/node/v20.15.1/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
export NVM_DIR="$HOME/.nvm"
cd /Users/aswinraj/Documents/WorkFolder/SharedProjects/RNGames/.claude/worktrees/silly-engelbart
exec npx expo start --web --clear
