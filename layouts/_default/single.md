{{- /* ============================================================
      markdown 输出格式的模板(见 hugo.toml 的 [outputFormats.markdown])
      ─────────────────────────────────────────────────────────────
      产物是 public/<这篇文章的路径>/index.md,右侧 HUD 上那枚
      「导出 Markdown」按钮(#hud-act md)指的就是它,带 download 属性直接下载。

      ★ 输出【源文件原文】(连 front matter 一起)而不是 .RawContent:
        用户要的是"导出本篇文章的 markdown",拿到手应该是一份能直接
        扔回 content/ 目录的文件,而不是掉了头部元数据的一截正文。
      ★ .File 为空的页面(纯生成页)没有源文件可读,退回 .RawContent。
      ============================================================ */ -}}
{{- with .File -}}
{{ os.ReadFile .Filename }}
{{- else -}}
{{ .RawContent }}
{{- end -}}
