# TAP Runtime Completion Blueprint

## Gate 3 / issue-11 Addendum

This wave only lands the minimum shell/code governance seam.

- Execution plane work is limited to metadata lowering plus grant enforcement.
- Reviewer / grant flow still narrows shell/code scope through `requestedScope` and `grantCompilerDirective.grantedScope`; it does not invent new execution objects.
- Checkpoint helpers only need to read back replay / activation / resume handoff slices from existing TAP snapshots.
- Activation driver still assembles capability registration only; it does not approve shell/code execution.
- Deferred beyond issue-11:
  - computer/browser/desktop execution closure
  - deeper command parsing
  - fully automatic replay dispatch
鐘舵€侊細璇︾粏璁捐绋?v1銆?
鏇存柊鏃堕棿锛?026-03-19

## 杩欎唤鏂囨。瑙ｅ喅浠€涔堥棶棰?
`TAP` 鐜板湪宸茬粡鏄彲鐢?runtime 鎺у埗闈紝浣嗗畠杩樻病鏈夊畬鎴愭渶鍚庝竴娈碘€滅湡闂幆鈥濄€?
褰撳墠缂虹殑涓嶆槸姒傚康锛岃€屾槸涓夋鐪熸浼氬奖鍝嶅彲鐢ㄦ€х殑鏈烘閾捐矾锛?
1. `activation driver`
2. `real builder`
3. durable `human gate / replay`

涓€鍙ョ櫧璇濓細

- 鐜板湪绯荤粺宸茬粡浼氱敵璇枫€佷細瀹℃牳銆佷篃浼氳鈥滃幓閫犱竴涓兘鍔涒€?- 浣嗛€犲畬涔嬪悗锛岃繕娌℃湁涓€涓湡姝ｇ殑瀹夎宸ユ妸鑳藉姏鎺ュ洖姹犲瓙
- 涔熻繕娌℃湁涓€涓湡姝ｇ殑鏂藉伐闃熸妸鑳藉姏绋冲畾閫犲嚭鏉?- 鏇存病鏈変竴鏉″湪杩涚▼閲嶅惎鍚庤繕鑳芥帴鐫€璺戠殑鎭㈠閾?
杩欎唤鏂囨。鐨勭洰鏍囧氨鏄妸杩欎笁娈靛交搴曡璁℃竻妤氾紝骞跺喕缁撲竴鏉¤兘澶熺洿鎺ヨ繘鍏ュ苟琛岀紪鐮佹媶瑙ｇ殑瀹炵幇涓婚摼銆?
## 褰撳墠鐪熷疄鐘舵€?
褰撳墠浠撳簱涓紝涓嬮潰杩欎簺浜嬪疄宸茬粡鎴愮珛锛?
- `dispatchIntent(capability_call)` 榛樿鍏堣蛋 `TAP`
- reviewer bootstrap worker bridge 宸叉垚绔?- provisioner bootstrap worker bridge 宸叉垚绔?- `DecisionToken` enforcement 宸叉垚绔?- `restricted -> waiting_human -> approve / reject` 宸叉垚绔?- replay / activation handoff skeleton 宸叉垚绔?
褰撳墠杩樻病鏈夊畬鎴愮殑鏄細

- provision 缁撴灉杩樻病鏈夎鑷姩婵€娲诲洖 `CapabilityPool`
- provisioner 杩樹笉鏄湡姝ｇ殑 `toolmakeragent`
- `waiting_human` 鍜?`pending replay` 杩樹笉鏄?durable 璁板綍

## 鎬讳綋璁捐鍘熷垯

### 1. reviewer 鍙锛屼笉鎵ц

- reviewer 鍙緭鍑?vote / decision
- reviewer 涓嶇洿鎺?dispatch grant
- reviewer 涓嶇洿鎺ュ啓浠ｇ爜
- reviewer 涓嶇洿鎺ュ畨瑁呭伐鍏?
### 2. TMA 鍙€狅紝涓嶆浛涓?agent 瀹屾垚鍘熶换鍔?
- TMA 鐨勭洰鏍囨槸浜у嚭 capability package 鍜岄獙璇佽瘉鎹?- TMA 涓嶈礋璐ｆ浛涓?agent 鎶婂師濮嬬敤鎴蜂换鍔″仛瀹?- TMA 涓嶈嚜宸辨壒鍑?activation

### 3. activation driver 鍙仛鏈烘瑁呴厤

- activation driver 涓嶅仛 LLM 鍐崇瓥
- activation driver 涓嶉噸鏂板 request
- activation driver 鍙礋璐ｆ妸 provision 浜х墿鎺ュ洖 execution plane

### 4. durable 閾句紭鍏堣创鐫€鐜版湁 checkpoint / journal 楠ㄦ灦璧?
- 鍏堝敖閲忓鐢?`agent_core` 宸叉湁鐨?`journal` 涓?`checkpoint`
- 鍏堣В鍐斥€滃穿鎺夊悗鑳芥仮澶嶁€?- 鍐嶈€冭檻鎶?control-plane 浜嬩欢杩涗竴姝ユ帹骞挎垚鏇撮€氱敤鐨勪簨浠跺眰

### 5. 涓嶈繃搴︽娊璞?
- 褰撳墠鍏堟妸 `TAP` 鍋氭垚绗竴濂楀畬鏁存牱鏉?- 鏈潵鍑虹幇绗簩涓?pool 鏃讹紝鍐嶆娊 shared primitives
- 鐜板湪鍙湪鏂囨。涓爣鍑衡€滃摢浜涘€煎緱澶嶇敤鈥濓紝涓嶅湪浠ｇ爜閲屾彁鍓嶅仛澶ц€岀┖鐨?shared framework

## 鐩爣瀹屾垚鎬?
杩欒疆涓嶆槸鎶?`TAP` 鍙樻垚鈥滄洿澶嶆潅鈥濄€?
杩欒疆鐨勭洰鏍囧畬鎴愭€佸緢绠€鍗曪細

1. 涓?agent 璇锋眰涓€涓綋鍓嶇己澶辩殑鑳藉姏
2. reviewer 瀹℃牳鍚庢妸璇锋眰杞粰 `TMA`
3. `TMA` 鐪熸鎶婅兘鍔涢€犲嚭鏉ワ紝骞堕檮 smoke / usage / rollback 淇℃伅
4. activation driver 鎶婅繖涓兘鍔涜嚜鍔ㄦ敞鍐屽洖 `CapabilityPool`
5. runtime 鎸?replay policy 鍐冲畾锛?   - 閲嶆柊瀹″悗娲惧彂
   - 鎴栫瓑寰呬汉宸?   - 鎴栫瓑寰呴獙璇侀€氳繃
6. 濡傛灉姝ゆ椂杩涚▼鎸傛帀锛岄噸鍚悗浠嶈兘鐭ラ亾锛?   - 鍝釜 gate 鍦ㄧ瓑浜?   - 鍝釜 replay 杩樻病璺?   - 鍝釜 activation 鍋氬埌鍝竴姝?
涓€鍙ョ櫧璇濓細

- 瑕佷粠鈥滃凡缁忔湁瀹℃壒鍗曞拰鏂藉伐鍥锯€?- 鍙樻垚鈥滅湡鐨勮兘閫犮€佺湡鐨勮兘瑁呫€佹柇鐢靛悗杩樿兘鎺ョ潃骞测€?
## 绗竴閮ㄥ垎锛欰ctivation Driver

### 褰撳墠闂

褰撳墠 runtime 宸茬粡鑳芥嬁鍒帮細

- `ProvisionArtifactBundle`
- `ProvisionAssetRecord`
- `PoolActivationSpec`
- activation handoff

浣嗙湡姝ｇ殑婵€娲诲姩浣滀粛鐒舵槸缂哄け鐨勩€?
浠庢祴璇曚笂鐪嬶紝杩欎釜缂哄彛宸茬粡闈炲父娓呮锛?
- 娴嬭瘯閲屼粛鐒堕渶瑕佹墜宸?`registerCapabilityAdapter(...)`
- 鍐嶆墜宸ユ妸 asset 鐘舵€佹敼鎴愬凡鎺ュ叆

杩欒鏄庣幇鍦ㄧ己鐨勬槸涓€涓湡姝ｇ殑 activation 鏈烘鎵ц鍣紝鑰屼笉鏄洿澶氳璁¤璁恒€?
### 璁捐瀹氫綅

`activation driver` 鏄?`TAP control plane -> CapabilityPool execution plane` 涔嬮棿鐨勮閰嶅眰銆?
瀹冧笉灞炰簬锛?
- reviewer
- provisioner / TMA
- 涓?agent loop

瀹冨睘浜庯細

- control-plane runtime 鐨勫悗娈垫墽琛屽櫒

### 瀹冭礋璐ｄ粈涔?
瀹冨彧璐熻矗 6 浠朵簨锛?
1. 鍙栧嚭寰呮縺娲荤殑 provision asset
2. 璇诲彇骞舵牎楠?`PoolActivationSpec`
3. 瑙ｆ瀽 `manifestPayload / bindingPayload / adapterFactoryRef`
4. 璋冪洰鏍?pool 鍋?`register / replace / register_or_replace`
5. 鏇存柊 asset lifecycle
6. 鐢熸垚 activation receipt锛屼氦鍥?runtime

### 瀹冧笉璐熻矗浠€涔?
- 涓嶉噸鏂板 request
- 涓嶇洿鎺ョ粰 grant
- 涓嶈繍琛屽師濮嬬敤鎴蜂换鍔?- 涓嶅喅瀹?replay policy
- 涓嶆浛 builder 鍋氶獙璇?
### 鏈€灏忚緭鍏?
- `ProvisionAssetRecord`
- `PoolActivationSpec`
- `CapabilityPackage` 鎴栫瓑浠?activation payload
- `adapterFactoryResolver`
- `targetPoolResolver`

### 鏈€灏忚緭鍑?
- `ActivationReceipt`
- 婵€娲诲悗鐨?pool registration 淇℃伅
- asset 鐘舵€佹洿鏂扮粨鏋?- 濡傚け璐ュ垯杈撳嚭 `ActivationFailure`

### 寤鸿鐘舵€佹満

`ready_for_review -> activating -> active`

澶辫触鍒嗘敮锛?
`ready_for_review -> activating -> failed`

琚浛鎹㈠垎鏀細

`active -> superseded`

### 寤鸿鏈€灏忛摼璺?
1. runtime 鍙戠幇 `ProvisionAssetRecord.status === ready_for_review`
2. reviewer 鎴?human gate 宸插厑璁歌繘鍏?activation
3. activation driver 鍏堟妸 asset 鐘舵€佹帹杩涘埌 `activating`
4. 瑙ｆ瀽 `PoolActivationSpec`
5. 閫氳繃 `adapterFactoryRef` 杩樺師鐪熸鐨?adapter
6. 鏋勯€?`CapabilityManifest`
7. 璋?`CapabilityPoolRegistry`
8. 鎴愬姛鍚庤涓嬶細
   - bindingId
   - generation
   - activated capability id
   - activatedAt
9. 鏇存柊 asset 涓?`active`
10. 鎶?activation receipt 浜ょ粰 replay dispatcher

### 鍏抽敭杈圭晫

activation driver 涓嶅簲璇ヤ粠 worker bridge 鍐呴儴琚皟鐢ㄣ€?
姝ｇ‘閾捐矾鏄細

- `TMA` 閫犲畬 -> 浜х墿杩涘叆 asset index -> runtime/activation driver 瑁呴厤

閿欒閾捐矾鏄細

- `TMA` 閫犲畬鍚庣洿鎺ヨ嚜宸辨妸 capability 娉ㄥ唽杩?pool

### 褰撳墠寤鸿鐨勬ā鍧楄惤鐐?
寤鸿浠嶇劧鏀惧湪锛?
- `src/agent_core/ta-pool-runtime/**`

鍘熷洜锛?
- 杩欐槸 control-plane runtime 鐨勫悗娈碉紝鑰屼笉鏄?execution plane 鏈綋
- 瀹冮渶瑕佺洿鎺ヨ TAP runtime 鐨?asset/replay/human gate 鐘舵€?- 涓嶅簲鏀惧埌 `capability-pool/**` 閲屾薄鏌?execution plane

寤鸿鍚庣画鍑虹幇锛?
- `activation-driver.ts`
- `activation-receipt.ts`
- `activation-factory-resolver.ts`

## 绗簩閮ㄥ垎锛歊eal Builder 涓?TMA

### 褰撳墠闂

鐜板湪鐨?provisioner 鏇村儚锛?
- 鈥滀竴涓煡閬撴€庝箞浜?capability package 鏍锋澘鐨勪汉鈥?
杩樹笉鏄細

- 鈥滀竴涓湡鐨勮兘鎶婂伐鍏疯濂姐€侀厤濂姐€佹祴濂姐€佷氦浠樺ソ鐨勫伐鍏峰埗閫?agent鈥?
褰撳墠 `worker bridge` 宸茬粡鍥哄畾浜嗕袱鏉?lane锛?
- `bootstrap`
- `extended`

杩欎釜鏂瑰悜鏄纭殑锛屼絾鐜板湪杩樻病鏈夋妸鈥滀細鍐欎氦浠樼墿鈥濇帹杩涘埌鈥滀細绋冲畾鏂藉伐鈥濄€?
### 鏂板畾浣?
浠庤繖涓€杞紑濮嬶紝寤鸿鎶?provisioner 瑙嗕负锛?
- `toolmakeragent`
- 绠€绉?`TMA`

### 涓轰粈涔堣鍒嗕袱灞?
濡傛灉鎶?`TMA` 鍋氭垚涓€涓棦鎬濊€冨張涔辫窇 shell 鐨?agent锛屽緢蹇氨浼氬嚭鐜颁袱涓棶棰橈細

1. reviewer 鏍规湰娌℃硶绋冲畾瀹℃牳
2. TMA 浼氬伔鍋峰畬鎴愪富浠诲姟锛岃€屼笉鏄彧閫犲伐鍏?
鎵€浠ュ缓璁妸 `TMA` 鍒嗘垚涓ゅ眰锛?
### TMA Planner

璐熻矗锛?
- 鐞嗚В缂虹殑 capability 鏄粈涔?- 鍏堝垽鏂槸鍚﹁兘澶嶇敤宸叉湁鑳藉姏
- 浜у嚭 build plan
- 浜у嚭 artifact contract
- 浜у嚭 verification plan
- 浜у嚭 rollback plan

涓嶈礋璐ｏ細

- 鐪熸鎵ц瀹夎
- 鐪熸淇敼绯荤粺鐜
- 鐪熸瀹屾垚鍘熷鐢ㄦ埛浠诲姟

### TMA Executor

璐熻矗锛?
- 鎸夋壒鍑嗗悗鐨?build plan 鍋氭満姊版墽琛?- 璺戝畨瑁呫€侀厤缃€佹祴璇曘€佹枃妗ｇ敓鎴?- 浜у嚭鐪熷疄 artifact
- 鏀堕泦 smoke / health / evidence

涓嶈礋璐ｏ細

- 鏀瑰啓 plan
- 鑷繁鎵╁ぇ鏉冮檺
- 鑷繁鎵瑰噯 activation

### 褰撳墠涓庣幇鏈?lane 鐨勫叧绯?
`bootstrap` lane 缁х画淇濈暀涓猴細

- repo 鍐呰兘鍔涙瀯寤?- 闄愬埗 shell
- 璺戝眬閮ㄦ祴璇?- 鐢熸垚 usage/skill/docs

`extended` lane 缁х画淇濈暀涓猴細

- 瀹夎渚濊禆
- 閰嶇疆 MCP
- 缃戠粶涓嬭浇
- 鏇村帤鐨勭郴缁熷噯澶囧伐浣?
浣嗕袱鑰呴兘瑕侀伒瀹堜竴鏉¤竟鐣岋細

- 鍙兘閫?capability
- 涓嶈兘鏇夸富 agent 鐩存帴鎶婂師浠诲姟鍋氬畬

### TMA 闇€瑕佺殑鏈€灏忓熀纭€鑳藉姏

#### bootstrap TMA

- `code.read`
- `docs.read`
- `repo.write`
- `shell.restricted`
- `test.run`
- `skill.doc.generate`

#### extended TMA

鍦?bootstrap 鍩虹涓婇澶栧鍔狅細

- `dependency.install`
- `mcp.configure`
- `network.download`
- `system.write`

### reviewer 闇€瑕佺殑鏈€灏忓熀纭€鑳藉姏

reviewer 涓嶉渶瑕佸帤鑳藉姏锛屽畠鍙渶瑕佷俊鎭兘鍔涳細

- `code.read`
- `docs.read`
- `project summary read`
- `inventory snapshot read`
- `memory summary read`
- 蹇呰鏃剁殑鍙鎼滅储

reviewer 涓嶅簲璇ユ嫢鏈夛細

- `repo.write`
- `shell.write`
- `dependency.install`
- `mcp.configure`
- `dispatch execution`

### Real Builder 鐨勬渶灏忎氦浠樼墿

涓€涓湡姝ｇ殑 builder 涓嶅彧浜ゅ洓涓?artifact ref銆?
瀹冭繕蹇呴』琛ラ綈涓嬮潰杩欎簺鐪熷疄淇℃伅锛?
1. `BuildPlan`
2. `BuildExecutionReport`
3. `VerificationEvidence`
4. `UsageDoc / Skill`
5. `RollbackHandle`

### 寤鸿閾捐矾

1. runtime 缁勮 `ProvisionRequest`
2. reviewer 鍐冲畾杞?provisioning
3. `TMA planner` 浜у嚭 build plan
4. 瀹℃牳閫氳繃鍚庯紝`TMA executor` 鏈烘鎵ц
5. executor 鏀堕泦璇佹嵁
6. 鐢熸垚鏍囧噯 capability package
7. provisioner runtime 浜у嚭 `ready bundle`
8. 浜ょ粰 activation driver

### 涓轰粈涔堣繖閲屽繀椤昏ˉ鍩虹 capability

鍥犱负濡傛灉娌℃湁杩欎簺鍩虹鑳藉姏锛?
- reviewer 鐪嬩笉瑙佺湡瀹為」鐩€?- `TMA` 涓嶈兘璇诲啓 repo
- `TMA` 涓嶈兘璺戞祴璇?- `TMA` 涓嶈兘瀹夎渚濊禆
- `TMA` 涓嶈兘閰嶇疆 MCP

閭ｄ箞 reviewer 鍜?`TMA` 灏遍兘鍙槸绌哄３銆?
## 绗笁閮ㄥ垎锛欴urable Human Gate / Replay

### 褰撳墠闂

鐜板湪 human gate 鍜?replay 杩欎袱鍧楅兘宸茬粡鈥滄湁璇箟鈥濅簡锛屼絾閮借繕鏄?runtime 鍐呭瓨鎬併€?
涔熷氨鏄锛?
- 褰撳墠杩涚▼閲屽畠浠兘宸ヤ綔
- 杩涚▼鎸傛帀鍚庯紝瀹冧滑涓嶈兘绋冲畾鎭㈠

### 杩欏潡鐪熸瑕佽В鍐充粈涔?
涓嶆槸鍏堝仛 UI銆?
鍏堣瑙ｅ喅鐨勬槸锛?
- 绯荤粺閲嶅惎鍚庤繕鐭ラ亾鑷繁鍗″湪鍝?- 骞朵笖鐭ラ亾涓嬩竴姝ヨ缁х画浠€涔?
### 寤鸿鏈€灏?durable 瀵硅薄

鍏堜笉瑕佹墿澶ц寖鍥淬€?
绗竴鐗?durable 鍖栧彧鍋?4 涓璞★細

1. `TaHumanGateState`
2. `TaHumanGateEvent[]`
3. `TaPendingReplay`
4. `TaActivationAttemptRecord`

### 涓轰粈涔?activation attempt 涔熻鎸佷箙鍖?
鍥犱负 activation driver 杩涘叆 `activating` 涔嬪悗锛屽鏋滆繘绋嬭繖鏃舵寕鎺夛細

- 浣犲繀椤荤煡閬撹繖娆?activation 鍒板簳鎴愬姛浜嗘病鏈?- 鏄惁闇€瑕佸洖婊?- 鏄惁鍙互閲嶈瘯

### 寤鸿鎸佷箙鍖栫瓥鐣?
绗竴鐗堜笉寮烘眰閲嶆瀯鏁翠釜 kernel event 绯荤粺銆?
鏇寸ǔ鐨勫仛娉曟槸锛?
#### Phase 1

鍏堣蛋 checkpoint-first durable 鏂规锛?
- gate/replay/activation 鐘舵€佷竴鏃﹀彉鍖?- 灏卞啓鍏?durable checkpoint snapshot

#### Phase 2

鍐嶈€冭檻鎶婅繖浜涚姸鎬佹娊鎴愭洿姝ｅ紡鐨?pool event 浣撶郴銆?
### 涓轰粈涔堝厛璧?checkpoint-first

鍥犱负鐜版湁 `CheckpointSnapshotData` 宸茬粡瀛樺湪锛?
- `run`
- `state`
- `sessionHeader`

杩欒鏄庢垜浠彧闇€瑕佺粰瀹冨鍔犱竴灞?control-plane snapshot 鎵╁睍锛岃€屼笉鏄幇鍦ㄥ氨閲嶆瀯鏁翠釜 `KernelEventType`銆?
### 寤鸿鏂板鐨?snapshot 褰㈢姸

寤鸿涓嶈鐩存帴鍐欐鎴?`tapSnapshot`銆?
寤鸿鐣欐垚鏇村彲澶嶇敤鐨勭粨鏋勶細

- `poolRuntimeSnapshots`

绗竴鐗堥噷闈㈠啀鎸傦細

- `tap`

渚嬪锛?
- `poolRuntimeSnapshots.tap.humanGates`
- `poolRuntimeSnapshots.tap.pendingReplays`
- `poolRuntimeSnapshots.tap.activationAttempts`

杩欐牱浠ュ悗鍑虹幇 `mp` / `cmp` 鏃讹紝鍙互鑷劧鎸傜浜屼釜銆佺涓変釜 pool 鐨勬仮澶嶇姸鎬併€?
### 鎭㈠鏃惰鍋氫粈涔?
runtime 鎭㈠鏃讹紝鏈€灏忓彧鍋氫袱姝ワ細

1. 浠?checkpoint 鎭㈠ pool runtime snapshot
2. 閲嶆柊鎶婅繖浜涚姸鎬佽鍥?runtime 鍐呭瓨绱㈠紩

鎭㈠鍚庣殑琛屼负锛?
- `waiting_human` 缁х画绛夊緟
- `pending_manual` 缁х画绛夊緟浜哄伐
- `pending_after_verify` 缁х画绛夊緟楠岃瘉瑙﹀彂
- `pending_re_review` 缁х画绛夊緟閲嶆柊瀹℃煡
- `activating` 鐘舵€佸彲浠ユ牴鎹?activation receipt 鍐冲畾鏄噸璇曡繕鏄洖婊?
### replay dispatcher 鐨勭涓€鐗堢洰鏍?
褰撳墠 replay 杩樺彧鏄?handoff銆?
绗竴鐗堢湡姝ｅ彲鐢ㄥ寲鏃讹紝涓嶉渶瑕佷竴娆″仛鎴愬叏鑷姩澶ц剳銆?
瀹冨彧闇€瑕佸彉鎴愪竴涓竻鏅扮殑 dispatcher锛?
- `none` -> 浠€涔堥兘涓嶅仛
- `manual` -> 缁存寔 gate
- `auto_after_verify` -> 楠岃瘉閫氳繃鍚庢帹缁?activation/replay trigger
- `re_review_then_dispatch` -> 鍥?reviewer 涓婚摼

### 鍏抽敭杈圭晫

durable human gate / replay 浠嶇劧瑕佺暀鍦?`TAP` 鍐呴儴銆?
涓嶈鎶婅繖浜涚瓑寰呰涔夊鍥?`core-agent loop` 鍘绘墦鏂姸鎬佹満銆?
`core-agent loop` 鍙簲璇ョ湅鍒帮細

- `deferred`
- `waiting_human`

鍏朵綑缁嗚妭缁х画鐢?`TAP` runtime 鑷繁鎸佹湁銆?
## 绗洓閮ㄥ垎锛氬缓璁殑瀹炵幇鎬婚摼璺?
### 缂哄け capability 鏃?
1. 涓?agent 鍙戣捣 `capability_call`
2. `TAP` 瀹℃牳
3. reviewer 鍒ゆ柇锛?   - 宸叉湁骞跺彲鎵?-> dispatch
   - 缂哄け -> redirect_to_provisioning
4. `TMA planner` 浜у嚭 plan
5. `TMA executor` 鐪熸鏋勫缓
6. provisioner runtime 浜у嚭 `ready bundle`
7. activation driver 瑁呭洖 `CapabilityPool`
8. replay dispatcher 鏍规嵁 policy 鍋氾細
   - re-review
   - manual wait
   - after verify
9. 缁х画杩涘叆涓?runtime 閾?
### 琚崱浣忔椂

1. `waiting_human`
2. durable snapshot 鍐欏叆
3. 杩涚▼鎸傛帀涔熻兘鎭㈠
4. 浜虹被鍥炴潵鎵瑰噯/鎷掔粷
5. 鍐嶇户缁?activation / replay / dispatch

## 绗簲閮ㄥ垎锛氬涓嬩竴涓?Pool 鐨勫鐢ㄨ竟鐣?
### 褰撳墠宸茬粡瓒冲閫氱敤銆佸€煎緱浠ュ悗鎶?shared 鐨勯儴鍒?
- `Request`
- `ReviewDecision`
- `Grant`
- `DecisionToken`
- `ProvisionRequest`
- `ArtifactBundle`
- `ActivationSpec`
- `ReplayPolicy`
- `HumanGateRecord`
- `ContextAperture`
- `WorkerPromptPack`
- `PoolRuntimeSnapshot`

杩欎簺涓滆タ鐨勫叡鍚岀偣鏄細

- 涓嶄緷璧?capability 鎵ц璇箟
- 鎹㈡垚 memory/context/governance 浠嶇劧璇村緱閫?
### 褰撳墠涓嶈杩囨棭鎶?shared 鐨勯儴鍒?
- `TaCapabilityTier`
- capability package 涓冧欢濂楃殑鍏蜂綋瀛楁鍚?- `CapabilityPool` 鐨?adapter 娉ㄥ唽涓庢墽琛岃涔?- capability-specific risk 渚嬪瓙
- `capabilityKey / capabilityKind / routeHints`

杩欎簺鏄?`TAP` 鐨?specialization layer锛屼笉搴旇鎻愬墠鎶芥垚鍏ㄥ眬閫氱敤灞傘€?
### 鏈€绋崇殑澶嶇敤绛栫暐

涓嶆槸锛?
- 鐜板湪灏辨妸 `TAP` 鍏ㄦ娊鎴?shared framework

鑰屾槸锛?
1. 鍏堟妸 `TAP` 鍋氭垚绗竴濂楀畬鏁存牱鏉?2. 褰?`mp` / `cmp` 鐪熷紑濮嬭惤鍦版椂
3. 鍐嶄粠涓や釜 pool 鐨勫叡鍚岄儴鍒嗛噷鎶?shared primitives

涓€鍙ョ櫧璇濓細

- 鍏堝仛鍑轰袱鍙扮湡鏈哄櫒
- 鍐嶅喅瀹氬摢鍑犱釜闆朵欢鐪熺殑鍊煎緱鏍囧噯鍖?
## 绗叚閮ㄥ垎锛氳繖杞箣鍚庣殑鎷嗕换鍔″師鍒?
涓嬩竴杞媶缂栫爜浠诲姟鏃讹紝寤鸿涓ユ牸鎸変笅闈㈢殑椤哄簭锛?
1. `activation driver`
2. `real builder / TMA`
3. durable `human gate / replay`
4. end-to-end 鑱旇皟

### 涓轰粈涔堜笉鑳藉厛鍋?durable

鍥犱负濡傛灉 activation driver 杩樻病鍋氾紝durable replay 鍙兘 durable 鍦板崱鐫€銆?
### 涓轰粈涔堜笉鑳藉厛澶ц妯¤ˉ reviewer

鍥犱负 reviewer 鐜板湪鐪熸缂虹殑涓嶆槸鈥滃啀鑱槑涓€鐐光€濓紝鑰屾槸鍚庨潰杩欐潯閾捐繕娌℃帴瀹炪€?
### 涓轰粈涔?`TMA` 蹇呴』鍦?activation 涔嬪墠璁捐娓呮

鍥犱负 activation driver 瑕佹帴鐨勪笉鏄娊璞℃蹇碉紝鑰屾槸 builder 浜ゅ嚭鐨勭湡瀹炶兘鍔涘寘銆?
## 褰撳墠鍐荤粨缁撹

杩欒疆璇︾粏璁捐鍐荤粨涓嬮潰杩欎簺鍏辫瘑锛?
- `activation driver` 鏄?control-plane 鍚庢鏈烘瑁呴厤鍣?- provisioner 灏嗙户缁敹鍙ｆ垚 `TMA`
- `TMA` 鍒?planner / executor 涓ゅ眰
- reviewer 缁х画鍙銆佸彧瀹°€佸彧鎶曠エ
- durable 鍏堣蛋 checkpoint-first锛屽啀鑰冭檻鏇村箍涔夌殑 pool events
- 褰撳墠鍏堟妸 `TAP` 鍋氭垚绗竴濂楀畬鏁存牱鏉匡紝涓嶆彁鍓嶆娊 shared framework


