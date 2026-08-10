# Aaron & Shark · AI 展示面（浏览器版）

这是桌面版「Aaron 和鲨鱼 AI 展示面」的本机浏览器版 MVP。

## 使用

直接双击 `index.html` 即可打开，也可以在项目目录运行：

```powershell
python -m http.server 5173
```

然后访问 `http://localhost:5173`。

## 工作流

1. 上传主图。
2. 在主图上拖拽绘制红圈。
3. 添加脸部、服装或配饰参考图，并可将一张脸部参考设为主参考。
4. 填写画面描述，生成提示词。
5. 复制提示词到 ChatGPT / Gemini，或导出项目 JSON。

图片只在当前页面内处理，不会自动上传到服务器。
