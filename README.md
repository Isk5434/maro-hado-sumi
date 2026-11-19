# まろいぬの覇道（墨と和紙のデザイン版）

[maro-hado](https://github.com/Isk5434/maro-hado) と同じゲーム・ルール説明を、和紙と墨の落ち着いた画面に作り直した版です。
カード・コマ・マスの絵（素材）はそのまま使い、枠・色・文字・操作感だけを変えています。

- 配色: 和紙（明）と墨（暗）の2系統、差し色はくすんだ朱と真鍮
- 文字: 見出しは Zen Old Mincho、本文は Zen Kaku Gothic New、数字と英字ラベルは IBM Plex Mono
- 部品: 角を立てた枠と鉤（かぎ）、点線の区切り、選ぶと墨色に反転する行、回る菱形の飾り
- デザインの決まりは `src/index.css` の先頭と `src/components/ui.tsx` にまとめています

---

# まろいぬの覇道 デモ

MARO が制作するボードゲーム「まろいぬの覇道」（短縮版）を、ルール確認のためにブラウザで遊べるようにしたデモです。
1台の端末を回して2〜4人で遊ぶ「交代プレイ」に対応しています。

- 実装しているルールと、その根拠（紙・会議・確認済・仮）は [docs/rules.md](docs/rules.md) にまとめています。
- ルールの判定は `src/game/`（画面に依存しない TypeScript）にあり、`src/game/game.test.ts` でルールブックの記述ごとに確かめています。

## 使い方

```bash
npm install
npm run dev      # 開発サーバー http://localhost:5173
npm test         # ルールのテスト
npm run deploy   # ビルドして Cloudflare Workers に公開（要 wrangler login）
```

## 構成

| 層 | 技術 |
|---|---|
| ルール | TypeScript（純粋関数・シード付き乱数） |
| 画面 | React + Vite + Tailwind CSS |
| 状態 | Zustand（戻す機能つき） |
| テスト | Vitest |
| 公開 | Cloudflare Workers（静的アセット） |
