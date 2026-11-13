# B 的 AI 配置页

这是准备合入小组仓库 [Elia-wxr/Project](https://github.com/Elia-wxr/Project) 的代码。

连接的 GitHub 账号是 Riley-Qing，没有权限直接往小组仓库建分支，所以先放在这里。

把下面这些文件按相同路径放进小组仓库的分支 `feat/b-ai-settings-ui`：

- `frontend/src/settings.ts`（新建）
- `frontend/src/settings-form.ts`（新建）
- `frontend/src/validate.ts`（新建）
- `frontend/style/settings.css`（新建）
- `frontend/src/api.ts`（替换小组仓库里的同名文件）
- `frontend/src/types.ts`（替换）
- `frontend/style/index.css`（替换，只多了第一行 `@import './settings.css';`，要 A 同意）
- `tests/frontend/settings-form.test.ts`
- `tests/register.mjs` 和 `tests/resolve-ts-hooks.mjs`（只为了在 Node 里跑测试）
- `tests/fixtures/` 里的 3 个 JSON

## 给 A 的挂载示例

不要改 `sidebar.ts` 里的抽牌流程。在侧栏里加一页即可：

```ts
const panel = new TarotSettingsPanel(client, {
  onSaved(snapshot) {
    // snapshot 里没有 API key。用 snapshot.status 更新侧栏上的 AI 状态。
  }
});
sidebar.node.appendChild(panel.node);

// 切回 Reading 之前：
if (!panel.confirmDiscard()) {
  return;
}
// 解读请求发出时：
panel.setReadingInProgress(true);
// 解读结束（成功或失败）时：
panel.setReadingInProgress(false);
```

根节点类名是 `jp-TarotSettingsPanel`。按钮用 `data-settings-action`，不要和侧栏已有的 `data-action="save"` 混用。

## 跑测试

在本仓库根目录：

```bash
node --experimental-strip-types --import ./tests/register.mjs --test tests/frontend/settings-form.test.ts
```

生产代码的相对导入不写 `.ts`，因为小组仓库的 `frontend/tsconfig.json` 会输出声明文件，写了 `.ts` 就编不过。测试加载器只在跑测试时补上扩展名。

代码里没有 AI 水印。
