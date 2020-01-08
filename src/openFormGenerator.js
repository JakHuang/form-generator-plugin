const vscode = require('vscode')
const fs = require('fs')
const path = require('path')
const open = require('open')

function getExtensionFileAbsolutePath(context, relativePath) {
    return path.join(context.extensionPath, relativePath)
}

/**
 * 从某个HTML文件读取能被Webview加载的HTML内容
 * @param {*} context 上下文
 * @param {*} templatePath 相对于插件根目录的html文件相对路径
 */
function getWebViewContent(context, templatePath) {
    const resourcePath = getExtensionFileAbsolutePath(context, templatePath)
    const dirPath = path.dirname(resourcePath)
    let html = fs.readFileSync(resourcePath, 'utf-8')
    // vscode不支持直接加载本地资源，需要替换成其专有路径格式，这里只是简单的将样式和JS的路径替换
    html = html.replace(/(<link.+?href="|<script.+?src="|<img.+?src=")(.+?)"/g, (m, $1, $2) => {
        return $1 + vscode.Uri.file(path.resolve(dirPath, $2)).with({ scheme: 'vscode-resource' }).toString() + '"'
    })
    return html
}

const methods = {
    writeFile: function (message, vscode, dirPath) {
        let { fileName, code } = message.data
        let filePath = path.join(dirPath, fileName)
        fs.writeFileSync(filePath, code)
        vscode.window.showInformationMessage(`文件${fileName}创建成功`)
    },
    openUrl: function (message, vscode, dirPath) {
        open(message.data.url)
    }
}

module.exports = function (context) {
    context.subscriptions.push(vscode.commands.registerCommand('extension.openFormGenerator', (uri) => {
        if (uri) {
            let dirPath = uri.fsPath,
                stat = fs.lstatSync(dirPath)
            if (stat.isFile()) dirPath = path.dirname(dirPath)

            let pclintBar = vscode.window.createStatusBarItem()
            pclintBar.text = `目标文件夹：${dirPath}`
            pclintBar.show()

            const panel = vscode.window.createWebviewPanel(
                'formGenerator',
                "表单设计器",
                vscode.ViewColumn.One,
                {
                    enableScripts: true, // 启用JS，默认禁用
                    retainContextWhenHidden: true, // webview被隐藏时保持状态，避免被重置
                }
            )
            panel.onDidChangeViewState(e => {
                if (panel.visible) {
                    pclintBar.show()
                } else {
                    pclintBar.hide()
                }
            })
            panel.webview.html = getWebViewContent(context, 'src/view/index.html')
            panel.webview.postMessage({
                cmd: 'setSrc',
                data: {
                    src: vscode.workspace.getConfiguration().get('openFormGenerator.src')
                }
            })
            panel.webview.onDidReceiveMessage(message => {
                if (message.cmd && message.data) {
                    let method = methods[message.cmd]
                    if (method) method(message, vscode, dirPath)
                } else {
                    vscode.window.showInformationMessage(`没有与消息对应的方法`)
                }
            }, undefined, context.subscriptions)
            panel.onDidDispose(e => {
                pclintBar.dispose()
            })
        } else {
            vscode.window.showInformationMessage(`无法获取文件夹路径`)
        }
    }))
}