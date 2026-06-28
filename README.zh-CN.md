# Extension Development Helper

[English](README.md)

面向日常开发的 VS Code 扩展，集成后缀补全、脚本运行、NPM 工具、前端与 Java 辅助等功能。

## 代码编辑增强

### Postfix 后缀补全

在表达式后输入 `.` 触发补全，按 Tab 展开为完整代码结构。支持 JavaScript、TypeScript、Vue、Svelte、HTML 等语言（可通过 `postfix.languages` 配置）。

内置模板：`var` / `let` / `const`、`await`、`for` / `forof` / `forin` / `foreach`。支持自定义模板（`postfix.customTemplates`）、禁用内置模板、自动推断变量名等。

```js
// "hello".let + Tab
let hello = "hello";
```

### 代码片段

为 JavaScript/TypeScript、Java、Vue 提供常用片段，例如 `clg`（console.log）、`sout`（System.out.println）、`temp`（Vue SFC 模板）等。

## 脚本运行与调试

### 一键运行

编辑器标题栏提供运行按钮，支持 JavaScript、TypeScript；Windows 下支持 Batch，macOS/Linux 下支持 Shell Script。输出在集成终端中显示，可通过 `runner.jsRunner` / `runner.tsRunner` 自定义运行命令（默认 JS 使用 `node`，TS 使用 `tsx`）。

### 调试

JavaScript / TypeScript 文件标题栏提供调试按钮，以当前文件为入口启动 Node 调试会话。

### 终端管理

终端右键菜单支持「关闭其他终端」与「关闭全部终端」，便于清理多余终端实例。

## NPM 与包管理

### package.json 快捷操作

- **区块跳转**：右键 `package.json` 可快速跳转到 `scripts`、`dependencies`、`devDependencies` 区域。
- **脚本 CodeLens**：在 `scripts` 上方显示 Install 按钮，每个脚本旁显示 Run 按钮，一键安装依赖或执行脚本。
- **依赖跳转**：`Ctrl/Cmd + 点击` 依赖名可跳转到本地 `node_modules` 中的 `package.json`，未安装时跳转 npm 官网。
- **打开 npm 页面**：右键菜单「Go to Npm」在浏览器中打开对应包或 npm 首页。
- **开发菜单**：`package.json` 右键额外提供重载窗口、命令面板、开发者工具等快捷入口。

同时支持 `dependencies.jsonc` 文件格式。

### 过期依赖检测

打开 `package.json` 时自动检测依赖版本是否落后，提供诊断提示与 Quick Fix（升级版本、安装缺失包等）。可通过 `npm-outdated.*` 配置忽略列表、更新级别、装饰样式、缓存时间等。

### node_modules 搜索

在资源管理器中右键 `node_modules` 文件夹，或在 NPM 视图标题栏点击搜索图标，以 Quick Pick 方式浏览、搜索包目录并打开文件。

## 前端开发辅助

### Tailwind CSS 类名补全

在 HTML、Vue、Svelte、JavaScript/TypeScript/JSX 及 CSS/Less/SCSS/Sass/Stylus 的 `class` 属性中提供 Tailwind 工具类补全。

### Vue 类名跳转

在 `.vue` 单文件组件中，支持模板 `class` 与 `<style>` 块之间的双向跳转（Go to Definition），便于维护样式与模板的对应关系。

## Java 开发辅助

### 基础语言服务

基于 AST 解析为 Java 提供：

- 大纲（Document Symbol）
- 代码折叠
- 跳转到定义 / 类型定义 / 实现
- 语义高亮（类、接口、枚举、方法、变量）
- 语法错误诊断

### MyBatis 集成

- Mapper 接口与 XML 文件双向关联，接口/方法旁显示 **Go to Mapper** CodeLens。
- 在 `*Mapper.xml` 和 `*mapper.xml` 文件中注入 SQL 语法高亮。

### 内联 SQL 高亮

在 Java、JavaScript、TypeScript 源码的字符串字面量中注入 SQL 语法高亮，便于阅读嵌入的 SQL 语句。

## 实用工具

### TinyPNG 图片压缩

资源管理器中右键 `.png` 文件，通过 TinyPNG API 压缩图片，支持覆盖原文件或另存为副本（后缀可配置）。需在设置中配置 `tinypng.apiKey`。

### 日期 Markdown 笔记

资源管理器文件夹右键「New Today Markdown」，以当天日期（`YYYY-M-D.md`）创建并打开 Markdown 文件，适合日记或每日笔记场景。

## 主要配置项

| 配置前缀 | 说明 |
| --- | --- |
| `postfix.*` | 后缀补全语言、自定义模板、变量名推断等 |
| `runner.*` | JS/TS 文件运行命令 |
| `npm-outdated.*` | 过期依赖检测行为 |
| `tinypng.*` | TinyPNG API Key 与输出后缀 |
