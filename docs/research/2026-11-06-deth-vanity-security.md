# dEth 靓号地址生成器源码安全调查

调查日期：2026-11-06。分析对象是官方仓库的 [`15df537882c69bcb04b223b88e0763a4afaf9d2a`](https://github.com/dethcrypto/dethtools/tree/15df537882c69bcb04b223b88e0763a4afaf9d2a)，该 HEAD 的提交日期为 2023-05-09。也静态检查了当时官网下发的页面和 Worker 构建代码；未执行线上生成，也未验证完整 bundle、运行环境、供应链或是否经过审计。

## 严重正确性问题：显示地址和显示私钥不匹配

[`getPrivateKey()`](https://github.com/dethcrypto/dethtools/blob/15df537882c69bcb04b223b88e0763a4afaf9d2a/src/lib/vanity-address/vanity-address.ts#L59-L65)产生私钥 `k`；[`getPublicKey(k)`](https://github.com/dethcrypto/dethtools/blob/15df537882c69bcb04b223b88e0763a4afaf9d2a/src/lib/vanity-address/vanity-address.ts#L67-L71)实际返回的是公钥坐标的 Keccak-256 哈希 `h`，并非公钥本身；[`getAddress(h)`](https://github.com/dethcrypto/dethtools/blob/15df537882c69bcb04b223b88e0763a4afaf9d2a/src/lib/vanity-address/vanity-address.ts#L73-L76)又把 `h` 当成私钥传给 `privateToAddress`。仓库锁定 [`ethereumjs-util` 7.1.4](https://github.com/dethcrypto/dethtools/blob/15df537882c69bcb04b223b88e0763a4afaf9d2a/yarn.lock#L7914-L7923) 的 [`privateToAddress`](https://unpkg.com/ethereumjs-util@7.1.4/dist/account.js) 定义为 `publicToAddress(privateToPublic(privateKey))`。

程序[筛选并返回](https://github.com/dethcrypto/dethtools/blob/15df537882c69bcb04b223b88e0763a4afaf9d2a/src/lib/vanity-address/vanity-address.ts#L101-L115) `address(h)` 和原始私钥 `k`；[页面展示这两者](https://github.com/dethcrypto/dethtools/blob/15df537882c69bcb04b223b88e0763a4afaf9d2a/pages/vanity-address-generator/index.page.tsx#L257-L270)。因此通常直接导入显示的 `k` 得到另一个地址，无法直接控制显示的靓号地址。`h` 本身是该派生靓号地址对应的私钥，知道原始 `k` 可离线重新计算 `h`，但不要将真实私钥发送给任何人或在线工具。由于 `h` 由 `k` 的公钥直接计算，只要该公钥泄露，任何人都能算出靓号的私钥；因此派生出的靓号密钥也不适合长期使用。

独立确定性复核使用公开测试私钥 `0x…01`，用本地工具分别计算标准钱包地址及上述双重派生地址：标准地址为 `0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf`，源码算法结果为 `0xBA3B0571b6EBB69b7563577efB1b8832b2905179`。这不是用户的钱包，也没有调用线上服务。两者不同。仓库[现有测试](https://github.com/dethcrypto/dethtools/blob/15df537882c69bcb04b223b88e0763a4afaf9d2a/src/lib/vanity-address/vanity-address.test.ts#L51-L80)只检查长度和结果对象形状，没有验证私钥导出的地址等于输出地址。

当前官网下发的[页面 chunk](https://tools.deth.net/_next/static/chunks/pages/vanity-address-generator-0d0583036616e363.js)和 [Worker chunk](https://tools.deth.net/_next/static/chunks/914.65d09fb88e519584.js)也包含相同的计算路径：对公钥做 Keccak 后传入 `privateToAddress`，同时返回原始私钥。两者是压缩构建代码的静态分析，未运行在线生成来验证输出，也不能证明发布包其他部分完全相同。

建议不要将当前观察到的生成器用于实际资金。若已有资金在生成的地址，应先离线用独立工具核实原始私钥是否对应地址；如果确实属于此算法，可在可信离线环境从原始私钥计算 `h`、独立验证其地址后谨慎恢复资金。

## 随机性、进程与泄漏面

- [`getPrivateKey`](https://github.com/dethcrypto/dethtools/blob/15df537882c69bcb04b223b88e0763a4afaf9d2a/src/lib/vanity-address/vanity-address.ts#L59-L65)使用 `crypto.randomBytes(32)`，并拒绝无效 secp256k1 私钥；搜索是独立抽样，不是 Profanity 式低熵种子展开。源码路径上没有发现用 `Math.random()` 生成私钥。
- 项目锁文件包含 [`crypto-browserify` 3.12.0](https://github.com/dethcrypto/dethtools/blob/15df537882c69bcb04b223b88e0763a4afaf9d2a/yarn.lock#L6786-L6801) 和 [`randombytes` 2.1.0](https://github.com/dethcrypto/dethtools/blob/15df537882c69bcb04b223b88e0763a4afaf9d2a/yarn.lock#L12078-L12083)。当前线上[共享 chunk](https://tools.deth.net/_next/static/chunks/fec483df-b45f4ee3b8e41c85.js)中 crypto-browserify 的 `randomBytes` 指向模块 2711，该模块使用 `crypto.getRandomValues` 或 `msCrypto.getRandomValues`，不可用时抛错，与 [`randombytes` 浏览器实现](https://unpkg.com/randombytes@2.1.0/browser.js)一致。这是静态构建代码分析，并不证明运行环境本身可信。
- [Worker](https://github.com/dethcrypto/dethtools/blob/15df537882c69bcb04b223b88e0763a4afaf9d2a/src/lib/vanity-address/worker.ts#L7-L15)在本地计算，并通过 `postMessage` 把结果（包含私钥）发回页面；相关实现未看到私钥上传或日志记录。但页面会将私钥明文放在 DOM 中，并提供[复制到剪贴板](https://github.com/dethcrypto/dethtools/blob/15df537882c69bcb04b223b88e0763a4afaf9d2a/src/components/lib/NodeBlock/NodeBlock.tsx#L41-L63)，所以同页面脚本、恶意扩展、剪贴板读取或设备被入侵等仍是风险。单看这条调用路径不能证明整站或线上发布版本绝无泄漏。
- 地址前后缀筛选属于随机样本过滤，并非私钥直接截断。越长的条件计算越慢；不能简单由此得出密钥生成安全或资金可用的结论。代码另存在 Worker 数量按 `hardwareConcurrency + 1` 创建、忽略用户设置，以及单 worker 100,000,000 次上限等可用性问题；不影响以上地址不匹配的结论。
