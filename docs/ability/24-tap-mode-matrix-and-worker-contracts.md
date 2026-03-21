# TAP Mode Matrix And Worker Contracts

## Gate 3 / issue-11 Addendum

For the shell/code execution line, the worker contract only adds the minimum governance placement:

- Reviewer still returns vote / narrower scope / deny pattern / constraints only.
- Reviewer does not emit execution payloads or dispatch shell/code directly.
- Provisioner still returns artifacts, activation payload, and replay recommendation only.
- Mechanical shell/code enforcement lives in execution plane through:
  - `allowedOperations`
  - `denyPatterns`
  - `pathPatterns` when path candidates are available
- Replay / activation handoff stays with TAP runtime, not reviewer or provisioner workers.
- Computer/browser/desktop remains deferred to issue-14.
鐘舵€侊細鍐荤粨璁捐鑽夋 v1锛岀敤浜庢妸 `TAP` 浠庘€滅涓€鐗堟帶鍒堕潰鈥濇帹杩涘埌鈥滃彲鐢ㄦ帶鍒堕潰鈥濄€?
鏇存柊鏃堕棿锛?026-03-19

## 杩欎唤鏂囨。瑙ｅ喅浠€涔堥棶棰?
褰撳墠 `TAP` 宸茬粡璇佹槑锛?
- `raw_agent_core` 鍙互鎺ュ叆鎺у埗闈?- capability request 鍙互璧?review / provision / safety
- 绗竴鐗?runtime assembly 宸茬粡鎴愮珛

浣嗚繕娌℃湁瑙ｅ喅涓嬮潰杩欎簺鐪熸浼氬奖鍝嶄娇鐢ㄤ綋楠岀殑闂锛?
1. 涓嶅悓鐢ㄦ埛鍒板簳璇ョ敤鍝妯″紡銆?2. reviewer 鍒板簳鑳芥媿浠€涔堟澘锛屼笉鑳藉仛浠€涔堜簨銆?3. provisioner 鍒板簳鑳介€犱粈涔堬紝涓嶈兘瓒婁粈涔堟潈銆?4. 浜虹被瀹℃壒鍦ㄤ粈涔堟ā寮忎笅蹇呴』鍑虹幇銆?5. 椋庨櫓鎻愮ず鎬庢牱鐢ㄧ櫧璇濇枃鐩存帴鍛婅瘔鐢ㄦ埛銆?
涓€鍙ョ櫧璇濓細

- 杩欎唤鏂囨。涓嶆槸鍦ㄨ璁衡€滀唬鐮佹€庝箞鍐欌€?- 鑰屾槸鍦ㄥ喕缁撯€滆皝鏈夋潈鍋氫粈涔堚€?
## 浜旂杩愯妯″紡

### 1. `bapr`

鍏ㄧО锛?
- `bypass-all-permission-and-review`

鎺ㄨ崘浠ｅ彿锛?
- `bapr`

瀹氫箟锛?
- reviewer 涓嶅啀鎵挎媴瀹℃壒鑱岃矗
- 鎵€鏈夎姹傞粯璁ゆ斁琛?- reviewer 鍦ㄨ繖涓ā寮忎笅鍙壙鎷呪€滃悜 provisioner 浼犺瘽鈥濆拰鈥滆褰曞彂鐢熶簡浠€涔堚€濈殑鑱岃兘

璇存槑锛?
- 杩欐槸涓€涓樉寮忛珮椋庨櫓妯″紡
- 蹇呴』鐢辩敤鎴锋墜鍔ㄥ紑鍚?- 蹇呴』閰嶅鍏嶈矗璇存槑鍜屽娆＄‘璁?
绗竴鐗堢害鏉燂細

- `bapr` 涓嶅仛甯歌瀹℃煡
- 鏂囨。灞傛槑纭爣璁颁负鈥滅敤鎴疯嚜璐熼闄┾€?
### 2. `yolo`

瀹氫箟锛?
- 榛樿楂樻斁琛?- 淇濈暀楂樺嵄琛屼负鎷︽埅

鐩爣鐢ㄦ埛锛?
- 楂樼啛缁冨紑鍙戣€?
琛屼负鍘熷垯锛?
- 澧炲垹鏀规煡榛樿鏀捐
- 甯歌娓呯悊榛樿鏀捐
- 鏄庢樉鍗遍櫓鍔ㄤ綔鎵嶆嫤鎴?
涓€鍙ョ櫧璇濓細

- `yolo` 涓嶆槸娌℃湁 reviewer
- `yolo` 閲岀殑 reviewer 鏇村儚瀹夊叏姘斿泭

### 3. `permissive`

瀹氫箟锛?
- 瀹芥澗瀹℃煡妯″紡

鐩爣鐢ㄦ埛锛?
- 澶у鏁板紑鍙戣€呴粯璁ゆ帹鑽?
琛屼负鍘熷垯锛?
- 甯歌寮€鍙戝姩浣滈粯璁ゆ斁琛?- 鍘氳兘鍔涘拰楂樺閮ㄦ€ц涓鸿繘鍏?review
- reviewer 鍙互鑷姩鎵瑰噯涓€閮ㄥ垎璇锋眰

### 4. `standard`

瀹氫箟锛?
- 鏍囧噯瀹℃煡妯″紡

鐩爣鐢ㄦ埛锛?
- 闈炵鐝敤鎴烽粯璁ゆ帹鑽?
琛屼负鍘熷垯锛?
- baseline 涔嬪鐨勫ぇ澶氭暟闈炲彧璇昏涓洪兘杩涘叆 review
- reviewer 鍙互鎵瑰噯
- 椋庨櫓杈冮珮鏃堕粯璁よ浆浜哄伐纭

### 5. `restricted`

瀹氫箟锛?
- 涓ユ牸瀹℃煡妯″紡

鐩爣鐢ㄦ埛锛?
- 楂樺畨鍏ㄣ€佷綆淇′换銆佸己娌荤悊鍦烘櫙

琛屼负鍘熷垯锛?
- baseline 涔嬪鐨勮涓洪粯璁よ繘鍏?review
- reviewer 涓嶇洿鎺ユ斁琛屾墽琛?- 闇€瑕佷汉绫绘壒鍑嗗悗鎵嶈兘缁х画

璁捐瑕佹眰锛?
- 绛夊緟鐘舵€佸繀椤荤暀鍦?`TAP` 鍐呴儴
- 涓嶅叆渚?`core-agent loop`
- `agent loop` 鍙湅鍒?`deferred` 鎴?`waiting_human`

## 椋庨櫓绛夌骇

绗竴鐗堢粺涓€涓夋。锛?
- `normal`
- `risky`
- `dangerous`

### 1. `normal`

鐧借瘽锛?
- 姝ｅ父寮€鍙戝拰姝ｅ父璇诲彇

鍏稿瀷渚嬪瓙锛?
- 璇讳唬鐮?- 璇绘枃妗?- repo 鍐呭皬鑼冨洿鏂板缓鎴栦慨鏀?- 杩愯甯歌娴嬭瘯
- 杩愯甯歌鏋勫缓
- 浣跨敤宸插瓨鍦ㄧ殑浣庨闄?capability

### 2. `risky`

鐧借瘽锛?
- 鍙兘鏈夋槑鏄惧壇浣滅敤锛屼絾閫氬父杩樿兘瑙ｉ噴娓呮

鍏稿瀷渚嬪瓙锛?
- 鏂拌宸ュ叿
- 鏇存柊宸叉湁 capability
- 閰嶇疆 MCP
- 澶栫綉涓嬭浇渚濊禆
- repo 鍐呭ぇ鑼冨洿鏀瑰啓
- 澶ц妯″垹闄ゅ伐浣滃尯鍐呭
- 宸ヤ綔鍖哄璇诲啓
- 闇€瑕佹洿楂?shell 鏉冮檺鐨勫姩浣?
### 3. `dangerous`

鐧借瘽锛?
- 涓€鏃︽墽琛岄敊锛屽悗鏋滃彲鑳藉緢閲?
鍏稿瀷渚嬪瓙锛?
- 姣佺伃鎬у垹闄?- 瀵瑰叧閿洰褰曟墽琛岀牬鍧忔€?shell
- 鏄庢樉瓒婄晫鐨勫伐浣滃尯澶栧啓鍏?- 缁勫悎楂樺嵄绯荤粺鍛戒护
- 楂橀闄?computer use
- 宸茬粡琛ㄧ幇鍑哄紓甯告剰鍥剧殑璇锋眰

## 妯″紡涓庨闄╃煩闃?
涓嬮潰杩欏紶鐭╅樀鏄涓€鐗堝喕缁撹涔夈€?
| 妯″紡 | `normal` | `risky` | `dangerous` |
| --- | --- | --- | --- |
| `bapr` | 榛樿鏀捐 | 榛樿鏀捐 | 榛樿鏀捐 |
| `yolo` | 榛樿鏀捐 | 榛樿鏀捐鎴栭檷鏉冩斁琛?| 榛樿鎷︽埅 |
| `permissive` | 榛樿鏀捐 | reviewer 瀹℃煡锛屽彲鑷姩鎵瑰噯/鎷掔粷/杞汉宸?| 榛樿鎷掔粷鎴栬浆浜哄伐 |
| `standard` | baseline 鐩存帴鏀捐锛屽叾浣欒繘鍏?reviewer | reviewer 瀹℃煡锛岄€氬父瑕佹槑纭敤鎴风‘璁?| 榛樿杞汉宸?|
| `restricted` | baseline 鏀捐锛屽叾浣欒繘鍏?reviewer + human gate | human gate | human gate |

## 鐢ㄦ埛渚х櫧璇濇彁绀鸿姹?
鎵€鏈夎 reviewer 鎷︿笅鎴栧崌绾т汉宸ョ殑璇锋眰锛岄兘蹇呴』鐢熸垚涓€娈电敤鎴疯兘绔嬪嵆鐪嬫噦鐨勭櫧璇濊鏄庛€?
鏈€灏戝寘鎷細

- 杩欐鎯冲仛浠€涔?- 涓轰粈涔堣鍒や负 `normal / risky / dangerous`
- 濡傛灉鎵ц锛屽彲鑳介€犳垚浠€涔堝悗鏋?- 濡傛灉涓嶆墽琛岋紝褰撳墠浠诲姟浼氬彈鍒颁粈涔堝奖鍝?- 鐢ㄦ埛鐜板湪鍙互鐐逛粈涔堟寜閽?
鐢ㄦ埛涓嶅簲璇ョ湅鍒板彧鏈夊伐绋嬫湳璇殑椋庨櫓鎶ュ憡銆?
鐢ㄦ埛搴旇鑳藉湪鍑犵鍐呯湅鎳傦細

- 杩欎簨鍗遍櫓涓嶅嵄闄?- 鍊间笉鍊煎緱缁х画
- 缁х画浜嗕細鍙戠敓浠€涔?
## Reviewer Worker Contract

### 瀹氫綅

- reviewer 鏄?`pool worker agent`
- reviewer 涓嶆槸涓讳换鍔?agent
- reviewer 涓嶆槸鎵ц鍣?- reviewer 涓嶆槸 builder

### reviewer 璐熻矗浠€涔?
- 鐞嗚В `AccessRequest`
- 缁撳悎 profile銆乵ode銆乮nventory銆侀」鐩憳瑕佸拰璁板繂鎽樿鍋氬垽鏂?- 杈撳嚭缁撴瀯鍖?decision vote
- 鍦ㄩ渶瑕佹椂鎶婅姹傝浆缁?provisioner 鎴栦汉绫?
### reviewer 涓嶈礋璐ｄ粈涔?
- 涓嶇洿鎺ユ墽琛?capability
- 涓嶇洿鎺?dispatch grant
- 涓嶇洿鎺ュ啓浠ｇ爜
- 涓嶇洿鎺ュ畨瑁呬緷璧?- 涓嶇洿鎺ヤ慨鏀圭郴缁?- 涓嶇洿鎺ユ浛涓?agent 缁х画鍋氫换鍔?
### reviewer 杈撳叆

- `AccessRequest`
- `CapabilityProfile`
- `mode`
- `risk level`
- `inventory snapshot`
- `project summary`
- `memory summary`
- `user intent summary`
- `rule summary`

### reviewer 杈撳嚭

- `decision`
- `reason`
- `risk_level`
- `risk_notes`
- `recommended_scope`
- `recommended_constraints`
- `required_followups`

### reviewer 榛樿鑳藉姏棰勭畻

绗竴鐗?reviewer 鍙厑璁革細

- 璇讳唬鐮?- 璇绘枃妗?- 璇婚」鐩憳瑕?- 璇昏蹇嗘憳瑕?- 鍙€夊彧璇绘悳绱㈡憳瑕?
绗竴鐗?reviewer 涓嶅厑璁革細

- 鍐欐枃浠?- 鏀逛唬鐮?- shell 鍐欐搷浣?- 瀹夎渚濊禆
- 澶栭儴楂樺嵄 MCP
- computer use

### reviewer bootstrap lane

reviewer 涓嶈兘鍚屾閫掑綊璧板畠姝ｅ湪鏈嶅姟鐨勫悓涓€鏉″鎵归摼銆?
绗竴鐗堣姹傦細

- reviewer 杩愯鍦ㄧ嫭绔嬬殑 bootstrap lane
- reviewer 鍙湅搴忓垪鍖栧悗鐨?aperture
- reviewer 鍙洖缁撴瀯鍖?vote

## Provisioner Worker Contract

### 瀹氫綅

- provisioner 鏄?`pool worker agent`
- provisioner 鏄?builder锛屼笉鏄富浠诲姟 agent
- provisioner 涓嶅喅瀹氭槸鍚︽壒鍑嗘墽琛?
### provisioner 璐熻矗浠€涔?
- 鏍规嵁 `ProvisionRequest` 鏋勫缓缂哄け capability
- 浜у嚭鏍囧噯鍖?artifact bundle
- 浜у嚭 smoke / health 缁撴灉
- 浜у嚭 usage 鏂囨。鎴?skill
- 浜ゅ洖 TAP 绛夊緟 activation 涓庡悗缁喅绛?
### provisioner 涓嶈礋璐ｄ粈涔?
- 涓嶇洿鎺ユ壒鍑嗚嚜宸辩殑鏋勫缓缁撴灉
- 涓嶇洿鎺ュ喅瀹氭槸鍚﹁涓?agent 浣跨敤
- 涓嶇洿鎺ユ浛涓?agent 瀹屾垚鍘熶换鍔?
### provisioner 杈撳叆

- `ProvisionRequest`
- `target capability spec`
- `inventory snapshot`
- `allowed build scope`
- `allowed side effects`
- `existing sibling capabilities`
- `project constraints`
- `reviewer instructions`

### provisioner 杈撳嚭

- `tool artifact`
- `binding artifact`
- `verification artifact`
- `usage artifact`
- `build summary`
- `activation payload`
- `replay recommendation`

### provisioner 榛樿鑳藉姏棰勭畻

绗竴鐗堝垎鎴愪袱灞傦細

- `bootstrap provisioner`
- `extended provisioner`

`bootstrap provisioner` 鍏佽锛?
- 璇讳唬鐮?- 璇绘枃妗?- repo 鍐呭啓鏂囦欢
- 鍙楅檺 shell
- 杩愯娴嬭瘯
- 鐢熸垚 skill/doc

`extended provisioner` 鍏佽锛?
- 瀹夎渚濊禆
- 閰嶇疆 MCP
- 缃戠粶涓嬭浇
- 鏇村帤鐨勭郴缁熺骇鑳藉姏

绗竴鐗堥粯璁わ細

- provisioner 榛樿杩愯鍦?`bootstrap` 灞?- 鍙湁 reviewer 鎴栦笂灞傜瓥鐣ユ壒鍑嗗悗锛屾墠鑳芥彁鍗囧埌 `extended`

## 褰撳墠闃舵鐨?context 璇存槑

褰撳墠 reviewer / provisioner 鐨勮瑙掞紝鏄樁娈垫€у崰浣嶏紝涓嶄唬琛ㄦ渶缁堟不鐞嗚瑙掋€?
绗竴鐗堟枃妗ｅ厛绾﹀畾锛?
- reviewer 榛樿鍙互鐪嬪埌 `agent_core` 渚ф彁渚涚殑鍏ㄩ儴鎽樿涓婁笅鏂?- 杩欐槸褰撳墠闃舵鐨?placeholder
- 鏈潵灏嗙敱 `memory_pool`銆乬overnance layer銆乸ackaging layer 鎻愪緵鏇寸簿缁?aperture

## 褰撳墠鍐荤粨缁撹

杩欎竴鐗堝厛鍐荤粨涓嬮潰杩欎簺鍏辫瘑锛?
- `TAP` 浣跨敤浜旂妯″紡锛歚bapr / yolo / permissive / standard / restricted`
- 椋庨櫓绛夌骇浣跨敤涓夋。锛歚normal / risky / dangerous`
- reviewer 鍙锛屼笉鎵ц
- provisioner 鍙€狅紝涓嶆壒鍑?- `bapr` 涓?reviewer 閫€鍖栦负浼犺瘽绛?- 鍏朵粬鍥涚妯″紡涓?reviewer 閮藉彲鑳芥嫆缁濊姹?- 浜虹被瀹℃壒瑕佺粰鐢ㄦ埛杈撳嚭鐧借瘽椋庨櫓璇存槑
- `restricted` 鐨勭瓑寰呴€昏緫鐣欏湪 `TAP` 鍐呴儴锛屼笉鎵撴柇 `core-agent loop`


