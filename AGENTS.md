# AGENTS.md

## テスト

```bash
bun test
```

## 起動

ビルド不要。`index.html` をブラウザで開くだけ。

## lint/typecheck

なし。

## アーキテクチャ

- `js/*-core.js` は純粋関数モジュール。DOM や副作用を含まない。
- `js/*.js` は DOM ラッパー(同名の `-core.js` を参照する場合がある)。
- テストは純粋モジュールにのみ実装し `bun:test` で記述する。

## コメントポリシー

ソースコードに独自コメント(説明コメント)は書かない。
JSDoc 記法(`@param`, `@returns`)による型注釈は許可する。

## スタイル

- ES module (`import`/`export`)。
- IIFE パターンでプライベート状態を隠蔽。
- `Object.freeze` で定数を不変化。
- 依存ゼロ。外部ライブラリ不使用。
