# 随包字体

运行字体为 `assets/fonts/BlackForestSerif-Regular.woff`，由 Noto Serif CJK SC Regular 制作子集、改名并以 WOFF 压缩，未修改字形轮廓。粗体由浏览器合成，当前没有独立粗体字重。

官方来源：https://github.com/notofonts/noto-cjk

固定提交：`f8d157532fbfaeda587e826d4cd5b21a49186f7c`

原路径：`Serif/OTF/SimplifiedChinese/NotoSerifCJKsc-Regular.otf`

OFL 1.1、版权声明和源文件/产物 SHA-256 随包存放在 `assets/fonts/`。不依赖在线字体服务。分发字体时必须保留这些许可文件。

## 更新文字后的操作

1. 将固定版本的原始 OTF 下载到 `.tmp-gen/font-source/NotoSerifCJKsc-Regular.otf`。此原始大文件不随运行包分发。
2. 运行 `python tools/build-game-font.py`。脚本读取 `src/**/*.js`、`locales/*.js` 和入口页面，构建字形子集；注释也会纳入，所以清单中的不支持字符不一定是可见文字。
3. 检查 MANIFEST 的缺字列表。任何实际可见文案的缺字都需要解决；不能仅因为存在系统回退就忽略。
4. 运行 `node tools/verify-game-font.js` 和受影响场景的本地化排版测试；检查实景截图。测试脚本中的浏览器位置当前为开发机路径，后续桌面 CI 需改为可配置。

启动时先等待本地字体，成功后才创建 Phaser。失败或超过 10 秒时使用系统回退，并在 GAME_FONT_STATE 中记录；迟到的字体不会追加，避免同一局中出现字宽跳变。此回退保证可启动，不等于不同系统的回退排版完全一致。

当前子集针对简体中文和英文内容。繁体仍需对应地区字形和完整译文覆盖，不能仅根据简体字体含有部分繁体字就宣称繁体支持。

## 构建诊断

本机 fontTools 4.41.0 在名称表的 NameRecordVisitor 阶段耗时明显，独立诊断堆栈确认这一位置。因为需要完整保留所有名称与版权记录，构建器在字形子集处理期间暂存名称表，之后完整恢复并修改家族显示名称；修正后约数秒完成。日志使用 ASCII 转义，避免 Windows GBK 控制台输出非本地字符时误报失败。
