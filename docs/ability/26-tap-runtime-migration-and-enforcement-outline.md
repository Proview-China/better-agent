# TAP Runtime Migration And Enforcement Outline

## Gate 3 / issue-11 Addendum

This addendum only closes the shell/code execution governance seam inside the existing TAP contract.

- Execution plane still only consumes `CapabilityGrant + DecisionToken + CapabilityInvocationPlan`.
- Shell/code governance lowers as metadata only:
  - `executionGovernance.family`
  - `executionGovernance.operation`
  - `executionGovernance.subject`
  - `executionGovernance.pathCandidates`
- Mechanical enforcement in this wave is limited to:
  - `allowedOperations`
  - `denyPatterns`
  - `pathPatterns` when a request can expose path candidates
- `allowedOperations` may be expressed either as an action alias like `exec` or as the full capability key like `shell.exec`.
- Replay / activation / checkpoint handoff stays inside TAP runtime and durable checkpoint helpers; it does not become execution-plane policy.
- Out of scope here:
  - computer/browser/desktop closure
  - deep command semantic parsing
  - new global approval or lifecycle semantics
鐘舵€侊細鍐荤粨璁捐鑽夋 v1銆?
鏇存柊鏃堕棿锛?026-03-19

## 杩欎唤鏂囨。瑙ｅ喅浠€涔堥棶棰?
`TAP` 鐜板湪宸茬粡鑳借窇锛屼絾杩樹笉鏄粯璁ゆ€诲叆鍙ｃ€?
濡傛灉涓嶅厛鍐荤粨杩佺Щ绛栫暐鍜?enforcement 瑙勫垯锛屽悗闈細鍑虹幇锛?
- 涓€閮ㄥ垎 capability 璧?review
- 涓€閮ㄥ垎 capability 鐩存帴缁曡繃 review
- reviewer 鎵瑰嚭鏉ョ殑 scope 鍜?constraints 娌℃湁浜虹湡姝ｆ墽琛?
杩欎唤鏂囨。灏辨槸瑕佹妸杩欎袱浠朵簨閽夋锛?
1. `capability_call` 濡備綍榛樿鍒囧埌 `TAP`
2. reviewer 鐨?grant 濡備綍鍦?execution plane 琚満姊板己鍒舵墽琛?
## 涓€銆侀粯璁や富璺緞鍒囨崲绛栫暐

### 褰撳墠浜嬪疄

褰撳墠 `AgentCoreRuntime` 閲岋細

- `dispatchCapabilityIntentViaTaPool(...)` 宸插瓨鍦?- `dispatchIntent(...)` 榛樿杩樿蛋鏃х殑 `dispatchCapabilityIntent(...)`
- `runUntilTerminal()` 鐨?`capability_call` 涔熻繕娌￠粯璁ゅ垏鍒?`TAP`

### 鐩爣鐘舵€?
鐩爣涓嶆槸鍒犳帀鏃ц矾寰勶紝鑰屾槸鎶婅涔夋敼鎴愶細

- 鏅€?`capability_call` 榛樿鍏堣蛋 `TAP`
- 鏃х洿杈炬墽琛岃矾寰勫彧淇濈暀缁欐祴璇曘€佸簳灞傝皟璇曞拰鏄惧紡 bypass

### 杩佺Щ闃舵

#### Phase A

- 淇濈暀鏃ц矾寰?- 鏂板鏄庣‘鐨?`tap-first` runtime 鍏ュ彛
- 琛ラ綈娴嬭瘯鐭╅樀

#### Phase B

- `dispatchIntent(capability_call)` 榛樿鍏堣蛋 `TAP`
- 鏃ц矾寰勫彉鎴愭樉寮?bypass

#### Phase C

- `runUntilTerminal()` 鍜屼笂灞?orchestration 榛樿鍏ㄩ儴璧?`TAP`
- reviewer 鎴愪负 capability execution 鐨勬寮忔€婚椄闂?
### bypass 瑙勫垯

绗竴鐗堝厑璁稿瓨鍦ㄦ樉寮?bypass锛屼絾蹇呴』婊¤冻锛?
- 鍙緵娴嬭瘯鎴栧簳灞傝皟璇?- 涓嶈兘浣滀负鏅€氫富 agent 鐨勯粯璁よ矾寰?- 鏂囨。鍜屼唬鐮佷腑瑕佹槑纭爣璁?
## 浜屻€乬rant enforcement 瑙勫垯

绗竴鐗?reviewer 涓嶈兘鍙€滃啓瀹℃壒鍗曗€濓紝execution plane 蹇呴』鐪熸妫€鏌ャ€?
### 寮哄埗妫€鏌ラ」

鍦?execution plane 杩涘叆 `prepare / dispatch` 涔嬪墠锛岃嚦灏戞鏌ワ細

- `requestId` 鏄惁鍖归厤
- `capabilityKey` 鏄惁涓庡師 request 涓€鑷?- `grantedTier <= requestedTier`
- `scope` 鏄惁娌℃湁鏀惧
- `mode` 鏄惁娌℃湁琚敼鍐?- `expiry` 鏄惁鏈夋晥
- `constraints` 鏄惁婊¤冻
- deny pattern 鏄惁鏈杩濆弽

### grant 鏉ユ簮瑙勫垯

绗竴鐗堝喕缁擄細

- reviewer 鍙緭鍑?`decision vote`
- 鏈€缁?`CapabilityGrant` 鐢?kernel 鍐呯殑 `GrantCompiler` 鏈烘鐢熸垚

鐧借瘽锛?
- reviewer 鍙兘璇粹€滄垜寤鸿鎵瑰噯鈥?- 浣嗙湡姝ｇ殑閫氳璇佺敱鍐呮牳鐩栫珷

## 涓夈€乨ecision token

涓洪伩鍏?reviewer 杩斿洖鐨勬枃鏈粨鏋滆鐩存帴褰撴垚鎵ц鎺堟潈锛岀涓€鐗堥渶瑕佸喕缁擄細

- `DecisionToken`

鏈€灏戣〃杈撅細

- `request_id`
- `decision_id`
- `compiled_grant_id`
- `mode`
- `issued_at`
- `expires_at`
- `signature_or_integrity_marker`

execution plane 鍙帴鍙楋細

- 鐢?control-plane 鍐呮牳缂栬瘧骞剁鍙戠殑 token

execution plane 涓嶆帴鍙楋細

- 鐩存帴浠?LLM reviewer 杩斿洖鐨勫師濮?decision 鏂囨湰

## 鍥涖€乺estricted 妯″紡鐨勪汉绫诲鎵硅涔?
`restricted` 妯″紡鐨勭洰鏍囨槸锛?
- baseline 涔嬪鐨勮涓洪粯璁ゅ仠鍦?`TAP`
- reviewer 璐熻矗瑙ｉ噴椋庨櫓
- 浜虹被鍐冲畾鏄惁缁х画

### 杩愯瑕佹眰

- 绛夊緟鐘舵€佷繚鐣欏湪 `TAP`
- `core-agent loop` 涓嶈鎵撴柇鎴愬紓甯告祦
- loop 鍙劅鐭ュ埌 `deferred` 鎴?`waiting_human`
- 浜虹被鎵瑰浠ヤ簨浠跺舰寮忓洖娉?
## 浜斻€佺敤鎴蜂晶鐧借瘽瀹℃壒璇存槑

琚?reviewer 鎷掔粷銆佸欢鍚庛€佸崌绾т汉宸ャ€佹垨鏍囦负楂橀闄╃殑璇锋眰锛岄兘蹇呴』鐢熸垚闈㈠悜鐢ㄦ埛鐨勭櫧璇濊鏄庛€?
鏈€灏戝瓧娈碉細

- `plain_language_summary`
- `requested_action`
- `risk_level`
- `why_it_is_risky`
- `possible_consequence`
- `what_happens_if_not_run`
- `available_user_actions`

## 鍏€佸綋鍓嶅喕缁撶粨璁?
杩欒疆鍐荤粨涓嬮潰杩欎簺鍏辫瘑锛?
- `capability_call` 榛樿涓昏矾寰勫繀椤诲垏鍒?`TAP`
- reviewer 涓嶇洿鎺ヨ繑鍥炴渶缁?grant
- execution plane 蹇呴』鍋?grant mechanical enforcement
- `restricted` 鐨勭瓑寰呯暀鍦?`TAP`
- 浜虹被瀹℃壒蹇呴』鏈夌櫧璇濋闄╄鏄?

