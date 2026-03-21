# Skill Execution Roadmap

## Gate 3 / issue-11 Note

The TAP work in this wave only touches the shell/code governance seam around skill execution. It does not rewrite provider carriers.

- This wave adds TAP lowering metadata for shell/code requests:
  - family
  - operation
  - subject
  - pathCandidates
- This wave adds grant enforcement and checkpoint handoff read helpers only.
- OpenAI / Anthropic / DeepMind carrier lifecycle work stays with their own work packages.
鐘舵€侊細鎵ц璺嚎鍥俱€?
鏇存柊鏃堕棿锛?026-03-16

## 杩欎唤鏂囨。涓庡墠搴忔枃妗ｇ殑鍏崇郴

- `docs/ability/09-12` 淇濈暀涓?skill 璺嚎鐨勭爺绌朵笌鑽夋璁板綍锛?  - `09` 璐熻矗璺?SDK 姒傚康鐮旂┒
  - `10` 璐熻矗鍚戜笂鎺ュ彛涓庣害鏉熺爺绌?  - `11` 璐熻矗鍏叡鍔ㄤ綔涓庣涓夋柟璺敱鐮旂┒
  - `12` 璐熻矗鏃╂湡 v0 鍔ㄤ綔鑽夋
- 褰撳墠瀹為檯鎵ц銆佹帓鏈熴€佸畬鎴愬害涓庡瓙鏅鸿兘浣撳垎宸ワ紝浠ユ湰鏂囦欢涓哄噯銆?- 濡傛灉鍓嶅簭鏂囨。涓庡綋鍓嶄唬鐮佺幇鐘跺啿绐侊紝浠ュ綋鍓嶄唬鐮佸拰鏈矾绾垮浘涓哄噯銆?
## 杩欎唤鏂囨。鐨勭洰鏍?
杩欎唤鏂囨。涓嶆槸鍐嶈В閲婁粈涔堟槸 `skill`锛岃€屾槸鐩存帴鍥炵瓟鎵ц灞傞潰鐨勫洓涓棶棰橈細

1. 鎴戜滑宸茬粡瀹屾垚浜嗕粈涔堛€?2. `skill` 璺嚎鐜板湪澶ф瀹屾垚浜嗗灏戙€?3. 瑕佸仛鍒扳€滃敖鍙兘瀹屾暣瀹圭撼涓夊瀹樻柟 skill 鑳藉姏锛屽苟鎶?SDK 鑳藉姏鍚冮€忊€濓紝杩樺樊鍝簺闃舵銆?4. 鍚庣画濡備綍鎸夐€傚悎鍗曚釜瀛愭櫤鑳戒綋鐨勭矑搴︾户缁帹杩涖€?
## 褰撳墠缁撹

- 褰撳墠 `skill` 璺嚎宸茬粡瀹屾垚浜嗏€滅粺涓€鍏叡璇█ + 鏈湴 bundle + 瀹樻柟 carrier 杞瘧鈥濈殑绗竴闃舵銆?- 褰撳墠鏇村悎鐞嗙殑瀹屾垚搴︿及绠楁槸锛?*绾?94%**銆?- 杩欎釜鐧惧垎姣旂殑鍚箟涓嶆槸鈥滀唬鐮侀噺鍐欎簡 38%鈥濓紝鑰屾槸锛?  - 鍩虹鐮旂┒宸插畬鎴?  - 绗竴鎵瑰叕鍏卞姩浣滃凡钀藉湴
  - 涓夊瀹樻柟 carrier 宸插紑濮嬬湡瀹炶浆璇?  - 浣嗙鈥滃畬鏁村绾充笁瀹?skill 鍏ㄩ噺鑳藉姏鈥濊繕宸?managed/hosted銆佺敓鍛藉懆鏈熴€佹洿澶氬畼鏂瑰弬鏁般€丆ontext/Packaging 闆嗘垚鍜岀湡瀹?live verification

## 褰撳墠宸插畬鎴愬唴瀹?
### 1. 鏂瑰悜涓庤竟鐣屽凡缁忓畾娓?
- `skill` 鍥炴敹鍒?infra/adapter 灞傘€?- `skill` 璐熻矗璐寸潃涓夊瀹樻柟 skill carrier 鍋氱粺涓€鎺ュ叆銆?- 鏇村鏉傜殑鑳藉姏缁勭粐缁х画鏀惧洖锛?  - packaging engine
  - context manager
  - policy
  - ledger

### 2. 缁熶竴鍏叡璇█宸茬粡璧峰ソ

褰撳墠 `rax.skill` 宸叉湁锛?
- `loadLocal`
- `define`
- `containerCreate`
- `discover`
- `list`
- `get`
- `publish`
- `remove`
- `listVersions`
- `getVersion`
- `publishVersion`
- `removeVersion`
- `setDefaultVersion`
- `bind`
- `activate`
- `prepare`
- `use`
- `mount`

### 3. `skill` 宸茶繘鍏ョ粺涓€ capability 璇箟

褰撳墠 registry / 璇嶈〃宸插寘鍚細

- `skill.define`
- `skill.discover`
- `skill.list`
- `skill.read`
- `skill.create`
- `skill.update`
- `skill.remove`
- `skill.bind`
- `skill.activate`
- `skill.use`
- `skill.load`

### 4. 涓夊瀹樻柟 carrier 宸插紑濮嬬湡瀹炶浆璇?
- OpenAI锛?  - `shell`
  - `environment.skills`
- Anthropic锛?  - API `container.skills`
  - SDK filesystem `Skill`
- Google ADK锛?  - `SkillToolset`

### 5. 鏈湴 source 鍙戠幇宸茬粡鍙敤

- 鍙互鐩存帴璇诲彇鍗曚釜鏈湴 skill 鐩綍
- 鍙互鎵弿鐖剁洰褰曚笅澶氫釜 child skill packages
- 鍗?skill 鐖剁洰褰曞彲鑷姩瑙ｆ瀽
- 澶?skill 鐖剁洰褰曚細鏄庣‘鎶?`skill_source_ambiguous`

### 6. 褰撳墠楠岃瘉鍩虹嚎

- `npm run typecheck` 閫氳繃
- `npm test` 閫氳繃
- `npm run smoke:skill:live` 宸茶惤鑴氭墜鏋讹紝榛樿璧板彧璇婚獙璇侀摼锛?  - OpenAI / Anthropic锛氫紭鍏?list/get/listVersions/getVersion
  - Google ADK锛氶獙璇?managed lifecycle 鐨?unsupported boundary
- 褰撳墠 live smoke 鏂拌瀵燂細
  - 鐢ㄦ埛褰撳墠 `.env.local` 鎸囧悜鐨?OpenAI / Anthropic 涓婃父瀵?`/skills` / `beta.skills` read-only 璺敱鍧囪繑鍥?`404`
  - 杩欒鏄庡綋鍓?route 涓嶈兘琚綋鎴?hosted skill registry 浣跨敤锛屽嵆浣垮畼鏂?SDK 鏂囨。鏀寔璇ョ敓鍛藉懆鏈?- compatibility/profile 鏂版敹鍙ｏ細
  - `raxLocal` 鐜板湪浼氱洿鎺ラ樆鏂?gateway profile 涓嬬殑 managed skill registry 鍔ㄤ綔
  - 涓嶅啀渚濊禆杩滅 `404` 浣滀负涓昏鑳藉姏鍒ゅ畾鏂瑰紡
- query passthrough 鏂版敹鍙ｏ細
  - OpenAI `list/listVersions` 鐜板湪鍙€氳繃 `providerOptions.openai` 閫忎紶锛?    - `after`
    - `limit`
    - `order`
  - Anthropic `list/listVersions` 鐜板湪鍙€氳繃 `providerOptions.anthropic` 閫忎紶锛?    - `limit`
    - `page`
    - `betas`
    - `source` 浠嶄繚鐣欏湪鍏叡 `input`
  - Anthropic `get/publish/remove/getVersion/publishVersion/removeVersion` 鐜板湪涔熷彲閫氳繃 `providerOptions.anthropic` 閫忎紶锛?    - `betas`
    - builder 浠嶄細鑷姩骞跺叆 `skills-2025-10-02`
  - Anthropic upload surfaces 鐜板湪涔熶細鑷姩骞跺叆瀹樻柟 upload beta锛?    - `files-api-2025-04-14`
    - 褰撳墠鑼冨洿锛?      - `client.beta.skills.create`
      - `client.beta.skills.versions.create`
- provider-specific official extension 鏂版敹鍙ｏ細
  - OpenAI `skill content retrieve` 宸茶繘鍏ヤ唬鐮侊細
    - `client.skills.content.retrieve`
    - `client.skills.versions.content.retrieve`
  - OpenAI shell carrier 鐜板湪涔熷凡瑕嗙洊绗笁绉嶅畼鏂?skill shape锛?    - inline skill bundle
    - 褰撳墠鎸夊畼鏂?`InlineSkill` 褰㈢姸杩涘叆 `tools[].environment.skills`
    - 褰撳墠浠嶄繚鎸?provider-specific carrier锛屼笉鎵╂垚鏂扮殑鍏叡鍔ㄤ綔
    - `rax.skill.use()/mount()` 鐜板湪涔熷凡鏈?inline shell end-to-end coverage
  - OpenAI managed upload prepared payload 鐜板湪涔熸洿璐村畼鏂?SDK锛?    - `publish / publishVersion` 涓嶅啀鎶?`files` 浼鎴愯嚜瀹氫箟 bundle body
    - 褰撳墠鏀逛负 `args + bundle` 鍒嗙鐨?call plan
    - 鏇磋创杩?`openai-node` 鐨?`Uploadable | Uploadable[]` 鎵ц鏈?lowering 璇箟
  - OpenAI hosted shell lifecycle 鐜板湪涔熸洿璐村畼鏂癸細
    - `skill_reference.version` 鏀寔 numeric / `"latest"`
    - attachment version 涓?hosted version resource metadata 宸叉媶寮€锛屼笉鍐嶅洜涓?attachment version 鑷姩浼€?`skill.version`
    - hosted `environment` override 鐜板湪鍙壙杞?hosted shell settings锛?      - `file_ids`
      - `memory_limit`
      - `network_policy`
  - Anthropic API managed lifecycle 鐜板湪涔熷彲閫氳繃 `providerOptions.anthropic` 閫忎紶锛?    - `betas`
    - 鍗充娇鐢ㄦ埛鏄惧紡浼犱簡 `betas`锛宮anaged carrier 浠嶄細缁х画鑷姩骞跺叆涓?`code_execution_type` 瀵瑰簲鐨勫畼鏂?beta
    - `rax.skill.use()/mount()` 鐜板湪涔熷凡鏈?API-managed carrier 绔埌绔鐩?    - Anthropic quickstart 椋庢牸鐨?prebuilt skill 璺緞鐜板湪涔熷凡鏈夊叕鍏变娇鐢ㄩ潰瑕嗙洊锛?      - `type: "anthropic"`
      - `skill_id: "pptx"`
      - `version: "latest"`
  - Anthropic upload-only lifecycle 鐜板湪涔熸洿璐村畼鏂癸細
    - `client.beta.skills.create`
    - `client.beta.skills.versions.create`
    浼氳嚜鍔ㄥ苟鍏ワ細
    - `files-api-2025-04-14`
    - `skills-2025-10-02`
    涓斾笉鎶婅繖灞傝嚜鍔ㄦ墿澶у埌 `list/get/remove`
  - Anthropic API-managed carrier override 鐜板湪宸叉湁鏄惧紡 runtime coverage锛?    - `code_execution_type`
    - `allowed_callers`
    - managed skill `type`
    - managed skill `version`
    - carrier `betas`
    - legacy official `code_execution_20250522`
- `skill live smoke` 鐜板湪浼氳嚜鍔ㄥ啓鍏?JSON report锛?  - 榛樿璺緞锛?    - `memory/live-reports/skill-live-smoke.json`
- `skill capability report` 宸茶繘鍏ヤ唬鐮佸苟鍙敓鎴愶細
  - 鑴氭湰锛?    - `npm run report:skill:capability`
  - 榛樿杈撳嚭锛?    - `memory/live-reports/skill-capability-report.json`
  - 褰撳墠鑳界粺涓€琛ㄨ揪涓夊眰锛?    - official support
    - local gateway compatibility
    - live smoke evidence
    - prepared payload summary
  - 褰撳墠宸茬粏鍖栧埌 action-level matrix锛?    - `list`
    - `get`
    - `publish`
    - `remove`
    - `listVersions`
    - `getVersion`
    - `publishVersion`
    - `removeVersion`
    - `setDefaultVersion`
    - `getContent`
    - `getVersionContent`
  - 褰撳墠 action-level report 杩樹細甯?machine-readable 瀛楁锛?    - `preparedPayload`
    - `routeEvidence`
    - `routeSummary`
- 褰撳墠娴嬭瘯缁撴灉锛?  - `144 pass / 0 fail`

## 瀹屾垚搴︿及绠?
### 褰撳墠浼扮畻锛氱害 94%

#### 宸插畬鎴愰儴鍒?
- 鐮旂┒涓庤竟鐣屾緞娓咃細90%
- 鍏叡璇█鍔ㄤ綔瀹氫箟锛?0%
- 鏈湴 bundle / local source 瑁呰浇锛?0%
- provider carrier 鍒濈増杞瘧锛?5%
- managed lifecycle prepared invocation锛?5%
- live verification scaffold锛?5%
- compatibility/profile truthfulness锛?5%
- provider-specific extension modeling锛?0%
- capability report generation锛?8%
- action-level capability report锛?2%
- public type truthfulness锛?5%
- facade 浣跨敤闈細85%

#### 鏈畬鎴愰儴鍒?
- 鏇磋创瀹樻柟 SDK 鐨勬彁浜ゅ弬鏁颁笌 builder 瀹屾暣搴?- managed / hosted skill 鐢熷懡鍛ㄦ湡
- 涓夊鏇村畬鏁寸殑 discovery/list/create/update/version 鏀寔
- skill 涓?MCP / packaging engine / context manager 鐨勫彲鎺ч泦鎴?- live verification 涓庣湡瀹?provider smoke
- 绗笁鏂?skill hub / registry 鐨勭粺涓€鍏ュ彛

## 浠€涔堝彨鈥滆繖鏉＄嚎瀹屾垚鈥?
濡傛灉鎴戜滑璇粹€渟kill 璺嚎鍩烘湰瀹屾垚鈥濓紝鑷冲皯瑕佹弧瓒充笅闈㈣繖鍑犳潯锛?
### A. 涓夊瀹樻柟 carrier 閮芥湁绋冲畾鐨勫叕鍏辫瑷€鏄犲皠

- OpenAI锛?  - local shell skills
  - hosted shell skills
  - skill references / versions
- Anthropic锛?  - SDK filesystem skills
  - API managed skills
  - discovery/list path
- Google ADK锛?  - local directory skills
  - code-defined skills
  - SkillToolset integration

### B. `rax.skill` 浣跨敤闈㈠畬鏁?
鑷冲皯鍖呮嫭锛?
- `loadLocal`
- `discover`
- `define`
- `bind`
- `activate`
- `prepare`
- `use`
- `mount`

骞朵笖姣忎釜鍔ㄤ綔閮借兘鏄庣‘鏄犲皠鍒板畼鏂?carrier 鎴?SDK-ready 璋冪敤鍙傛暟銆?
### C. 鐢熷懡鍛ㄦ湡瓒冲瀹屾暣

鏍规嵁 provider 鑳藉姏锛岃嚦灏戣ˉ榻愶細

- list / discover
- create / publish
- version / attach
- mount / activate
- teardown / cleanup

娉ㄦ剰锛?
- 涓嶆槸鎵€鏈?provider 閮藉繀椤绘敮鎸?hosted registry
- 浣?`rax.skill` 瑕佽兘鎶娾€滃摢浜涙湁銆佸摢浜涙病鏈夆€濊鐪熻瘽

### D. 鐪熷疄楠岃瘉鍏呭垎

鑷冲皯瑕佹湁锛?
- 鏈湴 contract tests
- provider-specific unit tests
- 鑷冲皯涓€缁?live verification

### E. 涓庡寘瑁呮満鏋舵瀯鐨勮竟鐣岀ǔ瀹?
- `skill` 淇濇寔瀹樻柟 carrier adapter 韬唤
- 鍖呰鏈虹户缁壙鎺ユ洿澶嶆潅鐨勭粍缁囪兘鍔?- 涓嶅啀鍙嶅鎶婂鏉傚害濉炲洖 `skill`

## 鎵ц闃舵鍒掑垎

### Phase 1: Thin Carrier Stabilization

鐩爣锛?
- 鎶婂綋鍓?`skill` 鐨?carrier 杞瘧灞傚仛绋?- 缁х画璐磋繎瀹樻柟 SDK

褰撳墠鐘舵€侊細

- **杩涜涓?*

瀹屾垚鏉′欢锛?
- `prepare / use / mount` 涓夊眰鎺ュ彛绋冲畾
- 涓夊 provider payload 褰㈢姸涓庡畼鏂规枃妗ｉ珮搴﹀榻?- 鏈湴涓?contract tests 绋冲畾

### Phase 2: Lifecycle Expansion

鐩爣锛?
- 鎵?`discover/list/create/version/attach` 杩欑被 lifecycle 鑳藉姏

褰撳墠鐘舵€侊細

- **杩涜涓?*

褰撳墠閲嶇偣锛?
- `WP-SKILL-02 Anthropic Managed Skills API`
- `WP-SKILL-01 OpenAI Hosted Lifecycle`
- `WP-SKILL-03 Google ADK SkillToolset Parity`

瀹屾垚鏉′欢锛?
- 鑷冲皯 OpenAI / Anthropic 鐨?managed or hosted 璺嚎杩涘叆浠ｇ爜
- Google ADK 鐨勬棤 hosted 鑳藉姏杈圭晫琚竻妤氳〃杈?
褰撳墠 truthfulness 寤鸿锛?
- `discover`
  - 淇濈暀缁欐湰鍦?metadata discovery
- `list / create / read / remove`
  - 淇濈暀缁?managed or hosted lifecycle 鍏叡璇█
- 鐗堟湰杈呭姪鍔ㄤ綔娌跨敤鍚屼竴缁勫叕鍏辨柟鍚戯細
  - `listVersions` -> `skill.list`
  - `getVersion` -> `skill.read`
  - `publishVersion` -> `skill.create`
  - `removeVersion` -> `skill.remove`
  - `setDefaultVersion` -> `skill.update`
- 涓嶈鎶?`discover` 鍜?`list` 娣锋垚涓€浠朵簨
- 褰撳墠 Google ADK 鍦ㄨ繖缁?managed lifecycle 涓婂簲鍏堟槑纭涓?`unsupported`

### Phase 3: Provider Parity And Truthfulness

鐩爣锛?
- 鎶婁笁瀹舵敮鎸侀潰銆佺己鍙ｃ€乫allback 閮借鍑?
褰撳墠鐘舵€侊細

- **杩涜涓?*

瀹屾垚鏉′欢锛?
- registry / docs / tests / runtime 鍥涘琛ㄨ堪涓€鑷?- unsupported / inferred / documented 璇寸湡璇?
### Phase 4: Packaging Engine Integration

鐩爣锛?
- 鎶?`skill` 杩欏眰鍜?packaging engine / context manager 骞崇ǔ鎺ヨ捣鏉?
褰撳墠鐘舵€侊細

- **鏈紑濮?*

瀹屾垚鏉′欢锛?
- skill 涓嶅啀闇€瑕佹壙杞藉浣欏鏉傚害
- 涓婂眰鍖呰鏈哄彲浠ュ畨鍏ㄦ秷璐?`Skill Container`

### Phase 5: Registry And External Skill Sources

鐩爣锛?
- 鎺ョ涓夋柟 skill hub / registry

褰撳墠鐘舵€侊細

- **鏈紑濮?*

瀹屾垚鏉′欢锛?
- 鑷冲皯鏀寔锛?  - local source
  - repo source
  - registry-like source
- source normalization / policy / trust 鍙敤

## 閫傚悎鍗曚釜瀛愭櫤鑳戒綋鐨?Work Packages

涓嬮潰杩欎簺 WP 鐨勭矑搴︼紝鍒绘剰鏀跺湪涓€涓瓙鏅鸿兘浣撹兘绋冲畾鎺ユ墜鐨勮寖鍥淬€?
### WP-SKILL-01 OpenAI Hosted Lifecycle

鐩爣锛?
- 琛?OpenAI hosted shell skill 鐨?lifecycle锛?  - reference
  - version
  - attach

涓昏鏂囦欢锛?
- `src/integrations/openai/api/tools/skills/*`
- `src/rax/skill-runtime.ts`
- `src/rax/runtime.test.ts`

楠屾敹锛?
- `skill.prepare()` / `skill.use()` 瀵?hosted shell 鏇磋创瀹樻柟
- 瀵?version/reference 褰㈢姸鏈夋槑纭祴璇?
### WP-SKILL-02 Anthropic Managed Skills API

鐩爣锛?
- 鎶?Anthropic API managed skills 鐨勮緭鍏?绾︽潫缁х画璐磋繎瀹樻柟

涓昏鏂囦欢锛?
- `src/integrations/anthropic/api/tools/skills/*`
- `src/rax/skill-runtime.ts`
- `src/rax/runtime.test.ts`

楠屾敹锛?
- `container.skills + code_execution` 璺嚎鏇磋创瀹樻柟
- SDK route 涓?API route 鍒嗙鏇存槑纭?
褰撳墠宸插畬鎴愰儴鍒嗭細

- managed lifecycle `betas` 宸蹭粠 facade 閫忎紶鍒?lifecycle builder
- API-managed carrier override 宸叉湁 runtime coverage锛?  - `code_execution_type`
  - `allowed_callers`
  - managed skill `type/version`
  - `use()/mount()` 鐜板湪涔熷凡鏈?API-managed carrier 绔埌绔鐩?  - Anthropic quickstart 椋庢牸鐨?prebuilt skill 璺緞涔熷凡鏈夊叕鍏变娇鐢ㄩ潰瑕嗙洊锛?    - `type: "anthropic"`
    - `skill_id: "pptx"`
    - `version: "latest"`

### WP-SKILL-01 OpenAI Hosted Lifecycle

褰撳墠宸插畬鎴愰儴鍒嗭細

- hosted shell attachment version 鐜板湪宸插拰 hosted version resource metadata 鎷嗗紑
- hosted shell attachment 鐜板湪瑕嗙洊鏇磋创瀹樻柟鐨?version 褰㈢姸锛?  - numeric version
  - `"latest"`
- hosted shell environment settings 鐜板湪宸叉湁 runtime coverage锛?  - `file_ids`
  - `memory_limit`
  - `network_policy`
- inline shell skill carrier 宸茶繘鍏ヤ唬鐮侊細
  - 鎸夊畼鏂?`InlineSkill` 褰㈢姸杩涘叆 `tools[].environment.skills`
  - 褰撳墠鍙綔涓?OpenAI provider-specific official carrier 寤烘ā
  - `use()/mount()` 鐜板湪涔熷凡鏈夌鍒扮瑕嗙洊
- managed upload prepared payload 鐜板湪涔熷凡鏀规垚鏇磋创 `openai-node` SDK 鐨?call plan锛?  - `args`
  - `bundle`
  鍒嗙琛ㄨ揪

### WP-SKILL-03 Google ADK SkillToolset Parity

鐩爣锛?
- 缁х画鏀剁揣 Google ADK local/code-defined 涓ょ skill carrier

涓昏鏂囦欢锛?
- `src/integrations/deepmind/api/tools/skills/*`
- `src/rax/skill-runtime.ts`
- `src/rax/runtime.test.ts`

楠屾敹锛?
- local path 鍜?code-defined path 鍧囨湁鏇寸粏娴嬭瘯
- payload 鏇存帴杩?ADK 鐪熷疄瀵硅薄褰㈢姸

### WP-SKILL-04 Source Adapters

鐩爣锛?
- 鎵?skill source 鍙戠幇涓庤鑼冨寲

涓昏鏂囦欢锛?
- `src/rax/skill-runtime.ts`
- `src/rax/skill-runtime.test.ts`

楠屾敹锛?
- parent directory / child skills / bundle 鍏ュ彛鏇寸ǔ
- source 閿欒鏇村彲瑙ｉ噴

### WP-SKILL-05 Public API Ergonomics

鐩爣锛?
- 鏀剁揣 `prepare / use / mount` 浣跨敤闈?
涓昏鏂囦欢锛?
- `src/rax/facade.ts`
- `src/rax/runtime.test.ts`
- `src/rax/index.ts`

楠屾敹锛?
- 绋嬪簭鍛樼殑涓婂眰璋冪敤鏇寸煭
- 浣嗕笉闅愯棌 provider truth

### WP-SKILL-06 Registry And Type Truthfulness

鐩爣锛?
- 璁?registry / types / docs 璺熷綋鍓?skill surface 瀹屾暣涓€鑷?
涓昏鏂囦欢锛?
- `src/rax/types.ts`
- `src/rax/registry.ts`
- `src/rax/registry.test.ts`
- `docs/ability/*.md`

楠屾敹锛?
- 璇嶈〃銆乺egistry銆佹枃妗ｃ€佷唬鐮佸榻?
褰撳墠宸插畬鎴愰儴鍒嗭細

- registry note 宸插悓姝ユ敹绱э細
  - OpenAI `skill.bind/activate` 鏄庣‘鎻愬埌 hosted shell `skill_reference` / hosted shell settings
  - Anthropic `skill.create` 鏄庣‘鎻愬埌 upload surface auto-merged official `files-api` beta
- `src/rax/index.ts` 鐜板湪宸插鍑烘渶灏?skill 鍏叡璇█灞傜被鍨嬶細
  - `SkillBindingDetailsInput`
  - `SkillBindingDetails`
  - `SkillProviderBindingLike`
  - `SkillActivationPayload`
  - `SkillActivationPlanLike`
- `src/rax/index.ts` 鐜板湪涔熷凡瀵煎嚭 provider-specific official override 杈撳叆闈細
  - OpenAI hosted/local/inline shell override types
  - Anthropic managed/filesystem override types
  - DeepMind local/code-defined override types

## 鍙洿鎺ュ鐢ㄧ殑瀛愭櫤鑳戒綋 Prompt 妯℃澘

涓嬮潰杩欎簺 prompt 鏄负鈥滀笂涓嬫枃鍘嬬缉鍚庣户缁紑宸モ€濆噯澶囩殑銆?
### Prompt A: OpenAI Hosted Lifecycle

```text
浣犺礋璐?WP-SKILL-01锛屽彧鏀?OpenAI hosted skill 鐩稿叧鏂囦欢銆傜洰鏍囷細璁?rax.skill 鐨?OpenAI hosted shell 璺嚎鏇磋创瀹樻柟 lifecycle锛坮eference/version/attach锛夛紝骞惰ˉ娴嬭瘯銆備笉瑕佹敼 Anthropic/Google 鏂囦欢锛屼笉瑕佸洖婊氬埆浜烘敼鍔ㄣ€傚畬鎴愬悗璇存槑鏀逛簡鍝簺鏂囦欢銆佸摢浜?payload 鏇磋创瀹樻柟銆侀獙璇佺粨鏋滃浣曘€?```

### Prompt B: Anthropic Managed Skills API

```text
浣犺礋璐?WP-SKILL-02锛屽彧鏀?Anthropic API/SDK skill carrier 鐩稿叧鏂囦欢銆傜洰鏍囷細鎶?managed skills API 鍜?SDK filesystem 璺嚎缁х画鏀剁揣鍒版洿璐村畼鏂癸紝骞惰ˉ瀵瑰簲娴嬭瘯銆備笉瑕佸姩 OpenAI/Google 鏂囦欢锛屼笉瑕佸洖婊氬埆浜烘敼鍔ㄣ€傚畬鎴愬悗璇存槑鏀逛簡鍝簺鏂囦欢銆佸摢浜?payload 鏇磋创瀹樻柟銆侀獙璇佺粨鏋滃浣曘€?```

### Prompt C: Google ADK SkillToolset

```text
浣犺礋璐?WP-SKILL-03锛屽彧鏀?Google ADK skill carrier 鐩稿叧鏂囦欢銆傜洰鏍囷細缁х画鏀剁揣 local/code-defined 涓ゆ潯 SkillToolset 璺嚎锛屽苟琛ユ洿璐村畼鏂?ADK 鐨勬祴璇曘€備笉瑕佸姩 OpenAI/Anthropic 鏂囦欢锛屼笉瑕佸洖婊氬埆浜烘敼鍔ㄣ€傚畬鎴愬悗璇存槑鏀逛簡鍝簺鏂囦欢銆乸ayload 鍙樺寲鍜岄獙璇佺粨鏋溿€?```

### Prompt D: Source Adapters

```text
浣犺礋璐?WP-SKILL-04锛屽彧鏀?skill-runtime 鍜?skill-runtime.test銆傜洰鏍囷細缁х画澧炲己鏈湴/澶氭簮/鐩綍寮?skill source 鍙戠幇涓庤鑼冨寲锛屼絾涓嶈鎵╁埌 provider carrier銆備笉瑕佸姩 facade/runtime/index/integrations锛屼笉瑕佸洖婊氬埆浜烘敼鍔ㄣ€傚畬鎴愬悗璇存槑鏀逛簡鍝簺鏂囦欢鍜岄獙璇佺粨鏋溿€?```

### Prompt E: Public API Ergonomics

```text
浣犺礋璐?WP-SKILL-05锛屽彧鏀?facade/runtime/index/runtime.test銆傜洰鏍囷細缁х画鏀剁揣 prepare/use/mount 杩欎簺涓婂眰鎺ュ彛锛岃瀹冧滑鏇村儚瀹屾暣 SDK 浣跨敤闈紝浣嗕粛淇濇寔 skill 鏄畼鏂?carrier adapter锛屼笉鎶婂寘瑁呮満澶嶆潅搴﹀鍥炴潵銆備笉瑕佸姩 skill-runtime/integrations锛屼笉瑕佸洖婊氬埆浜烘敼鍔ㄣ€傚畬鎴愬悗璇存槑鏀逛簡鍝簺鏂囦欢鍜岄獙璇佺粨鏋溿€?```

### Prompt F: Registry And Docs Truthfulness

```text
浣犺礋璐?WP-SKILL-06锛屽彧鏀?types/registry/registry.test/docs銆傜洰鏍囷細璁?skill 褰撳墠鍏叡璇█銆乺egistry銆乨ocs 琛ㄨ堪瀵归綈锛屾槑纭摢浜涘凡瀹屾垚銆佸摢浜涙湭瀹屾垚銆佸摢浜涘彧鏄?provider-specific extension銆備笉瑕佸姩 runtime/integrations锛屼笉瑕佸洖婊氬埆浜烘敼鍔ㄣ€傚畬鎴愬悗璇存槑鏀逛簡鍝簺鏂囦欢鍜岄獙璇佺粨鏋溿€?```

## 褰撳墠鎺ㄨ崘鎵ц椤哄簭

濡傛灉鍚庣画缁х画鐢ㄥ鏅鸿兘浣撴帹杩涳紝寤鸿椤哄簭鏄細

1. `WP-SKILL-02`
2. `WP-SKILL-01`
3. `WP-SKILL-03`
4. `WP-SKILL-06`
5. `WP-SKILL-05`
6. `WP-SKILL-04`

鐞嗙敱锛?
- 鍏堢户缁敹绱у綋鍓嶆渶鐑殑 Anthropic API / SDK 鍙岃矾绾?- 鍐嶇户缁敹 OpenAI hosted lifecycle
- 鎺ョ潃琛?Google parity
- 鐒跺悗浼樺厛鎶?registry / docs / code truthfulness 閿侀綈锛岄伩鍏嶈矾绾垮啀婕?- 鏈€鍚庡啀鏀朵笂灞?API 鍜?source adapter

## 涓€鍙ヨ瘽鏀跺彛

鐜板湪 `skill` 璺嚎宸茬粡涓嶆槸鈥滄槸鍚﹀彲鍋氣€濈殑闂锛岃€屾槸鈥滃浣曠户缁敤灏忔骞惰鎶婁笁瀹跺畼鏂?carrier 鍚冮€忊€濈殑闂銆?
褰撳墠鏈€鍚堢悊鐨勫仛娉曞氨鏄細

- 缁х画鎶?`skill` 缁存寔鎴愬畼鏂规壙杞介€傞厤灞?- 缁х画鎶婂鏉傝兘鍔涚暀鍦ㄥ寘瑁呮満鏋舵瀯
- 鐢ㄨ繖浠借矾绾垮浘鎶婂悗缁瘡涓瓙鏅鸿兘浣撶殑浠诲姟鏀跺湪灏忚寖鍥淬€佸彲楠岃瘉銆佸彲浜ゆ帴鐨勭矑搴?

