---
layout: post
title: 我的macOS初始化配置
date: 2027-07-30
tags: posts
---

# 我的macOS初始化配置

## 安装 brew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

## 安装一些常用软件

```bash
brew install ripgrep fzf pnpm neofetch
brew install --cask logseq kitty cron fork insomnia switchhosts visual-studio-code google-chrome notion
```

## 安装 Nerd_Fonts 字体

[教程](https://gist.github.com/davidteren/898f2dcccd42d9f8680ec69a3a5d350e)

```bash
brew tap homebrew/cask-fonts
brew search '/font-.*-nerd-font/' | awk '{ print $1 }' | xargs -I{} brew install --cask {} || true
```

## 克隆配置

```bash
mkdir ~/Documents/github

ssh-keygen -t rsa -b 4096 -C "kevalin123@gmail.com" -f ~/.ssh/github_rsa
cat \<\<EOL \> ~/.ssh/config
Host github.com
IdentityFile ~/.ssh/github_rsa
EOL

cd ~/Documents/github
git clone git@github.com:Kevalin/dotfiles.git
git clone git@github.com:Kevalin/logseq.git
```

## kitty config

```bash
mkdir -p ~/.config/kitty && cp ~/Documents/github/dotfiles/kitty/\* ~/.config/
```

## neovim config

```bash
mkdir -p ~/.config/nvim && cp -r ~/Documents/github/dotfiles/Nvim/\* ~/.config/nvim/
```

## 配置 fish 主题

```bash
curl -L https://get.oh-my.fish | fish
set -U theme_nerd_fonts yes
omf install mars
```

### 为 fish 配置 nvm 命令 和安装 Node.js

```bash
brew install nvm
omf install nvm
set -gx NVM_DIR (brew --prefix nvm)
brew install fisher
fisher install jorgebucaran/nvm.fish
nvm install 18
nvm use 18
set --universal nvm_default_version 18
exit
```

## 电池管理，电量不超过80%

```bash
brew tap zackelia/formulae
brew install bclm
sudo bclm write 80
sudo bclm persist
```

### 添加开机启动

```bash
sudo touch /Library/LaunchDaemons/com.example.bclmwrite80.plist
sudo vim /Library/LaunchDaemons/com.example.bclmwrite80.plist
cat /Library/LaunchDaemons/com.example.bclmwrite80.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.example.bclmwrite80</string>
    <key>ProgramArguments</key>
    <array>
      <string>/opt/homebrew/bin/bclm</string>
      <string>write</string>
      <string>80</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/Users/kevalin/Documents/logs/bclm.output.log</string>
    <key>WorkingDirectory</key>
    <string>/opt/homebrew/bin</string>
  </dict>
</plist>
EOF
sudo launchctl load /Library/LaunchDaemons/com.example.bclmwrite80.plist
sudo launchctl list | grep com.example.bclmwrite80
```
