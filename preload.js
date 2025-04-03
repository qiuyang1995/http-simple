window.exports = {
  "http-request": {
    mode: "none",
    args: {
      enter: (action) => {
        window.utools.hideMainWindow()
      }
    }
  }
}

// 暴露 uTools API 到渲染进程
window.utools = utools 