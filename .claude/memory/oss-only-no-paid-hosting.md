---
name: oss-only-no-paid-hosting
description: 本プロジェクトは全てOSS・費用ゼロ前提。有料サービスやサーバーレンタルを前提とした提案をしないこと。
metadata:
  type: project
---

パワプロ必要経験点計算アプリは「全てOSS、サーバーのレンタルなし」を前提に構成を決定した（2026-08-30）。採用スタックは React + TypeScript + Vite + Zustand + Papa Parse + idb + Vitest + Playwright（すべて MIT / Apache-2.0）。配布は public リポジトリ + GitHub Pages（無料枠）、実測データCSVのみ .gitignore で除外。

**Why:** ユーザーが明示的に「全てOSS、サーバーのレンタルなどは行わない想定で構成を再提案して」と指示したため。個人利用のツールであり、ランニングコストをかけない方針。

**How to apply:** 今後この プロジェクトで技術選定・機能追加を提案するとき、有料PaaS・マネージドDB・有料API・GPL系ライセンスの依存を提案しない。サーバーサイドが必要に見える要件が出たら、まずクライアント完結でできないかを検討する。private リポジトリ + GitHub Pages は有料プランが必要になるため、リポジトリは public を維持する。確定事項の一覧は `docs/00_index.md` §2 にある。
