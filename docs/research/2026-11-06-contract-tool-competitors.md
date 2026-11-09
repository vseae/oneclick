# 合约工具竞品一手资料记录

调查日期：2026-11-06。资料来自公开首页、发布的客户端脚本和公开仓库；本次环境没有可用的浏览器自动化会话，因此未实测钱包连接、链上调用、分享成功率或性能。首页宣传、代码实现和可实际使用之间可能有差异；未发现某项功能不等于该产品没有该功能。

## dEth Tools

[首页](https://tools.deth.net/)列出：ETH 单位、Token 单位、Unix Epoch/UTC、进制、String/Bytes32 转换；Calldata、Event、Transaction 解码；Constructor 编码；Vanity Address Generator。其[官方仓库 README](https://github.com/dethcrypto/dethtools)将产品描述为面向以太坊开发者的计算、编码和解码工具集。[发布的路由清单](https://tools.deth.net/_next/static/TU4wsFyR-g_978fybX5d9/_buildManifest.js)也包含这些页面。这里仅确认存在入口，未验证各工具的边界和实际结果。

## ContractReader

[首页](https://www.contractreader.io/)展示通过选择网络并输入合约地址或 Etherscan URL 搜索；列出的功能有语法高亮、测试网支持、实时链上值和浏览器内代码对比。首页所列网络为 Mainnet、Sepolia、OP Mainnet、Polygon、Arbitrum One、BNB Smart Chain、Base。[WETH 示例](https://www.contractreader.io/contract/mainnet/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2)有专属合约地址页面，但仅靠服务端返回内容无法核实其交互细节。

[Audit Tool 页面](https://www.contractreader.io/audit-tool)以 beta 注册形式宣传私有代码页、粘贴源码、测试网导入、ENS 访问控制、链上实时值、评论、GPT-4 安全审查和合约读写。此处仅引用产品宣传，未注册或验证可用性，不能当作公开版已实测的功能。

## SmartContractGUI

[首页](https://www.smartcontractgui.xyz/)的网页描述宣称上传 ABI 后可以读取和写入 EVM 合约，覆盖本地、测试网和主网，并包含集成测试工具；未逐条验证各链或 RPC 可用性。

本次发布的[客户端页面脚本](https://www.smartcontractgui.xyz/_next/static/chunks/pages/%5B%5B...linkId%5D%5D-c357f2da07ec0ec9.js)包含合约选择、新增/编辑 ABI、Gas 估算及失败原因、填入随机地址/当前钱包地址等控件文案；脚本还包含签名生成合约分享链接的流程，并提示分享后锁定地址和 ABI。这些是发布代码中可见的功能线索，未进行浏览器交互或验证分享后端。

## eth95

[eth95 README](https://github.com/adrianmcli/eth95/blob/529061c/README.md)描述通过 ABI 调用合约、使用 localhost:8545/MetaMask/自定义节点、监听 artifact 文件并自动更新、为代理调用编码、设置自定义 signer 和合约地址、内置输出日志。它既可通过 CLI 本地运行，也展示了包含 network 和 address 参数的[合约直达链接](https://eth95.dev/?network=1&address=0x6b175474e89094c44da98b954eedeac495271d0f)。

源码核实：[`server.ts`](https://github.com/adrianmcli/eth95/blob/529061c/src/server.ts)监听 artifact 目录中的 JSON 文件增删改，并通过 WebSocket 通知前端；[`useQueryStringContract.ts`](https://github.com/adrianmcli/eth95/blob/529061c/src/app/features/main/useQueryStringContract.ts)解析 URL 网络及地址参数并加载合约；[`ByEtherscan.tsx`](https://github.com/adrianmcli/eth95/blob/529061c/src/app/features/add-contract/ByEtherscan.tsx)支持从 Etherscan 获取公开 ABI，[`ByArtifact.tsx`](https://github.com/adrianmcli/eth95/blob/529061c/src/app/features/add-contract/ByArtifact.tsx)支持粘贴 artifact JSON。仓库提供的[自定义 signer 输入](https://github.com/adrianmcli/eth95/blob/529061c/src/app/features/connection/CustomSigner.tsx)接收私钥或助记词；这是其实现事实，不代表推荐在网页中收集私钥。调查时仓库 HEAD 为 `529061c`，最新提交日期为 2024-07-28；未验证在线服务及旧依赖在当前环境中的可用性。

## OneClick 现状与建议

基于当前工作区源码和未连接钱包时的本地页面检查；未连接真实钱包，未发送交易。工作区已有未提交代码，分析包含这些当前改动。

- 已有：合约目录及搜索、批量导入和备份、读写及方法搜索、Gas 估算、写入前 `eth_call` 预演、操作历史、两种批量读取模式，以及 12 个计算和 ABI 数据工具。参考 [`app/page.tsx`](../../app/page.tsx)、[`components/interact/ContractInteractView.tsx`](../../components/interact/ContractInteractView.tsx)、[`components/layout/ToolPanel.tsx`](../../components/layout/ToolPanel.tsx)、[`components/BatchReadTool.tsx`](../../components/BatchReadTool.tsx)。
- 地址导入：当前添加表单要求名称、地址和 ABI JSON；建议输入链及地址后获取已验证 ABI，失败时保留手动输入，显示来源、验证状态和代理实现地址。代理检测及其边界需要单独设计。参考 [`ContractForm.tsx`](../../components/contracts/ContractForm.tsx)。
- 只读入口：当前主交互面板依赖钱包连接，交易哈希与回执查询也依赖钱包 provider。建议独立选择网络及公共/自定义 RPC，允许无钱包只读，写入时再连接钱包。参考 [`app/page.tsx`](../../app/page.tsx)、[`use-wallet-clients.ts`](../../lib/use-wallet-clients.ts)。
- 参数可靠性：[`parseMethodParam`](../../lib/contract-utils.ts)将空整数转换为 0，将除了 `true` 以外的布尔文本转换为 false，定长数组也未按动态数组分支处理；建议类型化输入、必填校验及清晰错误。尤其在写入前，应展示完整网络、地址、方法、参数和原生币价值供用户核对。
- 批量读取：[`BatchReadTool.tsx`](../../components/BatchReadTool.tsx)通过 Multicall3 调用目标合约，目标看到的 `msg.sender` 是 Multicall3，而非连接账户；失败时单独重放获取错误使用不同调用上下文，可能导致诊断不一致。应提示差异并提供按指定账户直接读取的选项。该工具还先检查 `window.ethereum`，即使已通过非注入钱包连接也可能被拦截。
- 网络和原生币：钱包配置固定十条网络；表单可输入自定义 chain ID 不等于对应 RPC 和钱包网络已经可用。可根据目标用户添加网络或完整的自定义 RPC。交互和历史中将原生币硬编码为 ETH，在 Avalanche 等链会误导，应使用网络符号与精度。
- 开发工作流：可借鉴 eth95 的 artifact 导入及本地变动自动刷新、带链和地址的直达链接；分享链接需明确 ABI 来源及数据公开范围。代码阅读、历史状态查询及链上事件筛选可作为后续方向，不应把当前的回执/原始日志解码误认为事件浏览器。
- 数据部署：当前 API 和 SQLite 保存在服务端进程所在机器；在共享或公开部署前应设计用户隔离与访问控制，不能把“本地数据”直接理解成每个访问者浏览器私有数据。参考 [`sqlite-store.ts`](../../lib/server/sqlite-store.ts)、[`app/api/local-data/route.ts`](../../app/api/local-data/route.ts)。

建议优先级：先修复参数和批量读取语义、原生币标识；再做地址导入与无需钱包只读；随后补足直达链接、artifact 工作流与更丰富的链上浏览。衡量指标可包括地址到首次成功读取的完成率、完成步骤和耗时，ABI 自动获取成功率，以及写入前校验拦截和批量结果的正确性。
