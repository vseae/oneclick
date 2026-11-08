# EVM 合约交互及编码工具补充调研

调查日期：2026-11-06。以下功能来自产品官方说明和源码；只检查公开入口的 HTTP 响应和页面内容，没有连接钱包或实际提交交易，也没有逐一测试各链、RPC 或编码结果。HTTP 200 不代表全部功能正常。详细竞品及 OneClick 现状另见 [合约工具竞品一手资料记录](2026-11-06-contract-tool-competitors.md)。

| 工具 | 定位与已确认的功能 | 使用边界 |
| --- | --- | --- |
| [ABI Ninja](https://abi.ninja/) | 最接近通用合约交互界面。[官方仓库](https://github.com/BuidlGuidl/abi.ninja)说明可从 Etherscan API v2 获取已验证合约的 ABI 和源码、手动输入 ABI、实验性反编译未验证合约、识别常见代理、读取和写入代理；还列出自定义链、localhost、ENS 地址解析和可分享 URL。首页可访问（HTTP 200），展示未验证合约手动导入 ABI 和实验性反编译入口。 | README 对网络、代理支持的描述不是覆盖所有链或代理模式的保证；反编译标为实验性。 |
| [Remix IDE](https://remix.ethereum.org/) | 较完整的开发和调试环境。[Deploy & Run 文档](https://remix-ide.readthedocs.io/en/latest/run.html)说明可用 ABI 文件和地址加载已部署合约、调用其方法，连接浏览器钱包、WalletConnect、本地节点或外部 HTTP provider，也支持浏览器内 VM 与链分叉。入口返回 HTTP 200。 | 需要按 IDE 工作流配置环境和加载 ABI；不等于轻量级工具集合。 |
| [Etherscan](https://etherscan.io/) 及其网络浏览器 | [官方教程](https://info.etherscan.com/how-to-use-read-or-write-contract-features-on-etherscan/)说明已验证合约页面提供 Read/Write Contract，写入需连接钱包；[API 文档](https://docs.etherscan.io/etherscan-v2/api-endpoints/contracts)说明可以按链和地址获取已验证合约 ABI。首页返回 HTTP 200。 | 交互教程针对已验证合约；ABI API 要求 API key，支持网络及限额以服务配置为准。 |
| [Blockscout](https://eth.blockscout.com/) | 区块浏览器，官方文档说明可[读写已验证合约及其代理](https://docs.blockscout.com/devs/verification/interacting-with-smart-contracts)，[登录后添加自定义 ABI](https://docs.blockscout.com/using-blockscout/my-account/custom-abi)可在已验证或未验证合约使用 Write Custom。Ethereum 实例返回 HTTP 200。 | 文档的读写示例要求连接对应网络的钱包；自定义 ABI 流程要求登录。实例和功能可用性按链和部署而异。 |
| [HashEx ABI Encoder](https://abi.hashex.org/) | 聚焦函数和构造函数参数编码。[官方仓库](https://github.com/HashEx/abiencoder)说明可手动输入签名和类型，或粘贴 ABI 后选择函数/构造函数，并列出支持的类型及 tuple 示例。入口返回 HTTP 200，其[发布的客户端脚本](https://abi.hashex.org/static/js/main.c999ec9d.js)也描述 ABI 自动解析和参数编码。 | 本次只确认编码入口和文档；未实测类型边界或确认独立解码功能。 |
| [4byte.directory](https://www.4byte.directory/) | 这是函数 selector 和事件签名数据库，适合辅助识别未知 calldata/log 的候选签名；其[首页](https://www.4byte.directory/)和 [API 文档](https://www.4byte.directory/docs/)说明支持搜索、提交 ABI/源码和免认证 API。首页返回 HTTP 200。 | 签名映射是候选信息：4 字节 selector 可能碰撞，不能仅凭数据库命中认定实际函数或完整 ABI；它不是合约交互界面。 |

如果目标是快速通过地址调用合约，ABI Ninja 和浏览器的读写页更接近 SmartContractGUI；如果目标是编码参数，HashEx 更接近 dEth 的工具项；4byte.directory 可补充未知 selector 的候选查询。Remix 的功能更广，但交互路径相应更偏开发工作流。
