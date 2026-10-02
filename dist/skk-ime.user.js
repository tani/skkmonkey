// ==UserScript==
// @name         SKK Browser IME
// @namespace    cc.tani.skk-userscript
// @version      0.3.5
// @description  Local SKK Japanese input; TypeScript, skkeleton kana rules, local dictionaries
// @match        https://*/*
// @match        http://*/*
// @run-at       document-end
// @sandbox      raw
// @inject-into  page
// @resource     SKK_JISYO_L https://raw.githubusercontent.com/skk-dev/dict/master/SKK-JISYO.L
// @grant        GM_getResourceURL
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @license      MIT; kana table: Zlib
// ==/UserScript==
/*
Kana rules derived from vim-skk/skkeleton (altered browser version).
Copyright (c) 2021 kuuote

This software is provided 'as-is', without any express or implied warranty.
In no event will the authors be held liable for any damages arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
claim that you wrote the original software. If you use this software
in a product, an acknowledgment in the product documentation would be
appreciated but is not required.

2. Altered source versions must be plainly marked as such, and must not be
misrepresented as being the original software.

3. This notice may not be removed or altered from any source distribution.

*/
(function() {
	//#region src/dictionary.ts
	function parseSkk(text) {
		const entries = /* @__PURE__ */ new Map();
		for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
			if (line.startsWith(";") || !line.trim()) continue;
			const match = /^(\S+)\s+\/(.*)\/$/.exec(line);
			if (!match) continue;
			const candidates = [];
			let block = false;
			for (const token of match[2].split("/")) {
				if (token.startsWith("[")) {
					block = true;
					continue;
				}
				if (block) {
					if (token.endsWith("]")) block = false;
					continue;
				}
				if (!token || token.startsWith("(")) continue;
				const semicolon = token.indexOf(";");
				const item = semicolon < 0 ? { text: token } : {
					text: token.slice(0, semicolon),
					annotation: token.slice(semicolon + 1)
				};
				if (item.text && !candidates.some((c) => c.text === item.text)) candidates.push(item);
			}
			if (candidates.length) {
				const previous = entries.get(match[1]) ?? [];
				entries.set(match[1], [...previous, ...candidates.filter((c) => !previous.some((p) => p.text === c.text))]);
			}
		}
		return entries;
	}
	function validUserEntries(value) {
		const result = Object.create(null);
		if (typeof value !== "object" || value === null || Array.isArray(value)) return result;
		for (const [key, entries] of Object.entries(value)) {
			if (!/^[^\s/;]+$/.test(key) || !Array.isArray(entries)) continue;
			result[key] = entries.filter((x) => typeof x === "string" && x.length > 0 && x.length <= 1e3 && !/[\r\n/;]/.test(x)).slice(0, 100);
		}
		return result;
	}
	var Dictionary = class {
		base = /* @__PURE__ */ new Map();
		user = Object.create(null);
		revision = 0;
		constructor(text = "", user = {}) {
			this.base = parseSkk(text);
			this.user = validUserEntries(user);
		}
		lookup(key) {
			const user = this.user[key] ?? [];
			return [...user.map((text) => ({ text })), ...(this.base.get(key) ?? []).filter((c) => !user.includes(c.text))];
		}
		learn(key, text) {
			if (!text || /[\r\n/;]/.test(text) || text.length > 1e3 || !/^[^\s/;]+$/.test(key)) return;
			if (this.user[key]?.[0] === text) return;
			this.user[key] = [text, ...(this.user[key] ?? []).filter((c) => c !== text)].slice(0, 100);
			this.revision++;
		}
		exportUser() {
			return ";; SKK userscript personal dictionary (UTF-8)\n" + Object.entries(this.user).map(([key, values]) => `${key} /${values.join("/")}/`).join("\n") + "\n";
		}
	};
	//#endregion
	//#region src/kana-table.ts
	var kanaTable = [
		["!", ["！", ""]],
		[",", ["、", ""]],
		["-", ["ー", ""]],
		[".", ["。", ""]],
		[":", ["：", ""]],
		["?", ["？", ""]],
		["[", ["「", ""]],
		["]", ["」", ""]],
		["a", ["あ", ""]],
		["ba", ["ば", ""]],
		["bb", ["っ", "b"]],
		["be", ["べ", ""]],
		["bi", ["び", ""]],
		["bo", ["ぼ", ""]],
		["bu", ["ぶ", ""]],
		["bya", ["びゃ", ""]],
		["bye", ["びぇ", ""]],
		["byi", ["びぃ", ""]],
		["byo", ["びょ", ""]],
		["byu", ["びゅ", ""]],
		["cc", ["っ", "c"]],
		["cha", ["ちゃ", ""]],
		["che", ["ちぇ", ""]],
		["chi", ["ち", ""]],
		["cho", ["ちょ", ""]],
		["chu", ["ちゅ", ""]],
		["cya", ["ちゃ", ""]],
		["cye", ["ちぇ", ""]],
		["cyi", ["ちぃ", ""]],
		["cyo", ["ちょ", ""]],
		["cyu", ["ちゅ", ""]],
		["da", ["だ", ""]],
		["dd", ["っ", "d"]],
		["de", ["で", ""]],
		["dha", ["でゃ", ""]],
		["dhe", ["でぇ", ""]],
		["dhi", ["でぃ", ""]],
		["dho", ["でょ", ""]],
		["dhu", ["でゅ", ""]],
		["di", ["ぢ", ""]],
		["do", ["ど", ""]],
		["du", ["づ", ""]],
		["dya", ["ぢゃ", ""]],
		["dye", ["ぢぇ", ""]],
		["dyi", ["ぢぃ", ""]],
		["dyo", ["ぢょ", ""]],
		["dyu", ["ぢゅ", ""]],
		["e", ["え", ""]],
		["fa", ["ふぁ", ""]],
		["fe", ["ふぇ", ""]],
		["ff", ["っ", "f"]],
		["fi", ["ふぃ", ""]],
		["fo", ["ふぉ", ""]],
		["fu", ["ふ", ""]],
		["fya", ["ふゃ", ""]],
		["fye", ["ふぇ", ""]],
		["fyi", ["ふぃ", ""]],
		["fyo", ["ふょ", ""]],
		["fyu", ["ふゅ", ""]],
		["ga", ["が", ""]],
		["ge", ["げ", ""]],
		["gg", ["っ", "g"]],
		["gi", ["ぎ", ""]],
		["go", ["ご", ""]],
		["gu", ["ぐ", ""]],
		["gya", ["ぎゃ", ""]],
		["gye", ["ぎぇ", ""]],
		["gyi", ["ぎぃ", ""]],
		["gyo", ["ぎょ", ""]],
		["gyu", ["ぎゅ", ""]],
		["ha", ["は", ""]],
		["he", ["へ", ""]],
		["hh", ["っ", "h"]],
		["hi", ["ひ", ""]],
		["ho", ["ほ", ""]],
		["hu", ["ふ", ""]],
		["hya", ["ひゃ", ""]],
		["hye", ["ひぇ", ""]],
		["hyi", ["ひぃ", ""]],
		["hyo", ["ひょ", ""]],
		["hyu", ["ひゅ", ""]],
		["i", ["い", ""]],
		["ja", ["じゃ", ""]],
		["je", ["じぇ", ""]],
		["ji", ["じ", ""]],
		["jj", ["っ", "j"]],
		["jo", ["じょ", ""]],
		["ju", ["じゅ", ""]],
		["jya", ["じゃ", ""]],
		["jye", ["じぇ", ""]],
		["jyi", ["じぃ", ""]],
		["jyo", ["じょ", ""]],
		["jyu", ["じゅ", ""]],
		["ka", ["か", ""]],
		["ke", ["け", ""]],
		["ki", ["き", ""]],
		["kk", ["っ", "k"]],
		["ko", ["こ", ""]],
		["ku", ["く", ""]],
		["kya", ["きゃ", ""]],
		["kye", ["きぇ", ""]],
		["kyi", ["きぃ", ""]],
		["kyo", ["きょ", ""]],
		["kyu", ["きゅ", ""]],
		["ma", ["ま", ""]],
		["me", ["め", ""]],
		["mi", ["み", ""]],
		["mm", ["っ", "m"]],
		["mo", ["も", ""]],
		["mu", ["む", ""]],
		["mya", ["みゃ", ""]],
		["mye", ["みぇ", ""]],
		["myi", ["みぃ", ""]],
		["myo", ["みょ", ""]],
		["myu", ["みゅ", ""]],
		["n", ["ん", ""]],
		["n'", ["ん", ""]],
		["na", ["な", ""]],
		["ne", ["ね", ""]],
		["ni", ["に", ""]],
		["nn", ["ん", ""]],
		["no", ["の", ""]],
		["nu", ["ぬ", ""]],
		["nya", ["にゃ", ""]],
		["nye", ["にぇ", ""]],
		["nyi", ["にぃ", ""]],
		["nyo", ["にょ", ""]],
		["nyu", ["にゅ", ""]],
		["o", ["お", ""]],
		["pa", ["ぱ", ""]],
		["pe", ["ぺ", ""]],
		["pi", ["ぴ", ""]],
		["po", ["ぽ", ""]],
		["pp", ["っ", "p"]],
		["pu", ["ぷ", ""]],
		["pya", ["ぴゃ", ""]],
		["pye", ["ぴぇ", ""]],
		["pyi", ["ぴぃ", ""]],
		["pyo", ["ぴょ", ""]],
		["pyu", ["ぴゅ", ""]],
		["ra", ["ら", ""]],
		["re", ["れ", ""]],
		["ri", ["り", ""]],
		["ro", ["ろ", ""]],
		["rr", ["っ", "r"]],
		["ru", ["る", ""]],
		["rya", ["りゃ", ""]],
		["rye", ["りぇ", ""]],
		["ryi", ["りぃ", ""]],
		["ryo", ["りょ", ""]],
		["ryu", ["りゅ", ""]],
		["sa", ["さ", ""]],
		["se", ["せ", ""]],
		["sha", ["しゃ", ""]],
		["she", ["しぇ", ""]],
		["shi", ["し", ""]],
		["sho", ["しょ", ""]],
		["shu", ["しゅ", ""]],
		["si", ["し", ""]],
		["so", ["そ", ""]],
		["ss", ["っ", "s"]],
		["su", ["す", ""]],
		["sya", ["しゃ", ""]],
		["sye", ["しぇ", ""]],
		["syi", ["しぃ", ""]],
		["syo", ["しょ", ""]],
		["syu", ["しゅ", ""]],
		["ta", ["た", ""]],
		["te", ["て", ""]],
		["tha", ["てぁ", ""]],
		["the", ["てぇ", ""]],
		["thi", ["てぃ", ""]],
		["tho", ["てょ", ""]],
		["thu", ["てゅ", ""]],
		["ti", ["ち", ""]],
		["to", ["と", ""]],
		["tsu", ["つ", ""]],
		["tt", ["っ", "t"]],
		["tu", ["つ", ""]],
		["tya", ["ちゃ", ""]],
		["tye", ["ちぇ", ""]],
		["tyi", ["ちぃ", ""]],
		["tyo", ["ちょ", ""]],
		["tyu", ["ちゅ", ""]],
		["u", ["う", ""]],
		["va", ["ゔぁ", ""]],
		["ve", ["ゔぇ", ""]],
		["vi", ["ゔぃ", ""]],
		["vo", ["ゔぉ", ""]],
		["vu", ["ゔ", ""]],
		["vv", ["っ", "v"]],
		["wa", ["わ", ""]],
		["we", ["うぇ", ""]],
		["wi", ["うぃ", ""]],
		["wo", ["を", ""]],
		["wu", ["う", ""]],
		["ww", ["っ", "w"]],
		["xa", ["ぁ", ""]],
		["xe", ["ぇ", ""]],
		["xi", ["ぃ", ""]],
		["xka", ["か", ""]],
		["xke", ["け", ""]],
		["xo", ["ぉ", ""]],
		["xtsu", ["っ", ""]],
		["xtu", ["っ", ""]],
		["xu", ["ぅ", ""]],
		["xwa", ["ゎ", ""]],
		["xwe", ["ゑ", ""]],
		["xwi", ["ゐ", ""]],
		["xx", ["っ", "x"]],
		["xya", ["ゃ", ""]],
		["xyo", ["ょ", ""]],
		["xyu", ["ゅ", ""]],
		["ya", ["や", ""]],
		["ye", ["いぇ", ""]],
		["yo", ["よ", ""]],
		["yu", ["ゆ", ""]],
		["yy", ["っ", "y"]],
		["z(", ["（", ""]],
		["z)", ["）", ""]],
		["z,", ["‥", ""]],
		["z-", ["〜", ""]],
		["z.", ["…", ""]],
		["z/", ["・", ""]],
		["z[", ["『", ""]],
		["z ", ["　", ""]],
		["z]", ["』", ""]],
		["za", ["ざ", ""]],
		["ze", ["ぜ", ""]],
		["zh", ["←", ""]],
		["zi", ["じ", ""]],
		["zj", ["↓", ""]],
		["zk", ["↑", ""]],
		["zl", ["→", ""]],
		["zo", ["ぞ", ""]],
		["zu", ["ず", ""]],
		["zya", ["じゃ", ""]],
		["zye", ["じぇ", ""]],
		["zyi", ["じぃ", ""]],
		["zyo", ["じょ", ""]],
		["zyu", ["じゅ", ""]],
		["zz", ["っ", "z"]]
	];
	//#endregion
	//#region src/romaji.ts
	var rules = new Map(kanaTable);
	var prefixes = new Set(kanaTable.flatMap(([key]) => Array.from({ length: key.length - 1 }, (_, i) => key.slice(0, i + 1))));
	var Romaji = class {
		pending = "";
		feed(char) {
			this.pending += char;
			let out = "";
			while (this.pending) {
				const exact = rules.get(this.pending);
				if (exact && !prefixes.has(this.pending)) {
					out += exact[0];
					this.pending = exact[1];
					break;
				}
				if (prefixes.has(this.pending)) break;
				if (this.pending.startsWith("n")) {
					out += "ん";
					this.pending = this.pending.slice(1);
					continue;
				}
				out += this.pending[0];
				this.pending = this.pending.slice(1);
			}
			return out;
		}
		flush() {
			const result = this.pending === "n" ? "ん" : this.pending;
			this.pending = "";
			return result;
		}
	};
	function katakana(text) {
		return text.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 96));
	}
	function fullwidth(text) {
		return text.replace(/[!-~ ]/g, (c) => c === " " ? "　" : String.fromCharCode(c.charCodeAt(0) + 65248));
	}
	//#endregion
	//#region src/okuri.ts
	var okuriTable = {
		ぁ: "x",
		あ: "a",
		ぃ: "x",
		い: "i",
		ぅ: "x",
		う: "u",
		ぇ: "x",
		え: "e",
		ぉ: "x",
		お: "o",
		か: "k",
		が: "g",
		き: "k",
		ぎ: "g",
		く: "k",
		ぐ: "g",
		け: "k",
		げ: "g",
		こ: "k",
		ご: "g",
		さ: "s",
		ざ: "z",
		し: "s",
		じ: "j",
		す: "s",
		ず: "z",
		せ: "s",
		ぜ: "z",
		そ: "s",
		ぞ: "z",
		た: "t",
		だ: "d",
		ち: "t",
		ぢ: "d",
		っ: "x",
		つ: "t",
		づ: "d",
		て: "t",
		で: "d",
		と: "t",
		ど: "d",
		な: "n",
		に: "n",
		ぬ: "n",
		ね: "n",
		の: "n",
		は: "h",
		ば: "b",
		ぱ: "p",
		ひ: "h",
		び: "b",
		ぴ: "p",
		ふ: "h",
		ぶ: "b",
		ぷ: "p",
		へ: "h",
		べ: "b",
		ぺ: "p",
		ほ: "h",
		ぼ: "b",
		ぽ: "p",
		ま: "m",
		み: "m",
		む: "m",
		め: "m",
		も: "m",
		ゃ: "x",
		や: "y",
		ゅ: "x",
		ゆ: "y",
		ょ: "x",
		よ: "y",
		ら: "r",
		り: "r",
		る: "r",
		れ: "r",
		ろ: "r",
		ゎ: "x",
		わ: "w",
		ゐ: "x",
		ゑ: "x",
		を: "w",
		ん: "n"
	};
	function okuriLetter(okuri, fallback) {
		if (okuri === "っ") return "t";
		return okuriTable[okuri.match(/[^っ]/u)?.[0] ?? ""] ?? fallback;
	}
	//#endregion
	//#region src/engine.ts
	var Engine = class {
		mode = "ascii";
		phase = "direct";
		reading = "";
		okuri = "";
		okuriCode = "";
		abbrev = false;
		romaji = new Romaji();
		candidates = [];
		index = 0;
		output = "";
		request;
		dictionary;
		constructor(dictionary) {
			this.dictionary = dictionary;
		}
		get key() {
			return this.reading + this.okuriCode;
		}
		get active() {
			return this.phase !== "direct" || this.romaji.pending !== "";
		}
		get preedit() {
			if (this.phase === "candidate") return "▼" + (this.candidates[this.index]?.text ?? "") + this.display(this.okuri);
			if (this.phase !== "direct") return "▽" + this.display(this.reading) + (this.okuriCode ? "*" + this.display(this.okuri) : "") + this.romaji.pending;
			return this.romaji.pending;
		}
		display(text) {
			return this.mode === "katakana" ? katakana(text) : text;
		}
		reset() {
			this.phase = "direct";
			this.reading = "";
			this.okuri = "";
			this.okuriCode = "";
			this.abbrev = false;
			this.romaji.pending = "";
			this.candidates = [];
			this.index = 0;
		}
		setMode(mode) {
			const committed = this.finish();
			this.mode = mode;
			return committed;
		}
		finish() {
			const tail = this.romaji.flush();
			let text;
			if (this.phase === "candidate") {
				const candidate = this.candidates[this.index];
				this.dictionary.learn(this.key, candidate.text);
				text = candidate.text + this.display(this.okuri);
			} else text = this.display(this.reading + this.okuri + tail);
			this.reset();
			return text;
		}
		register(text) {
			if (!text || /[\r\n/;]/.test(text)) return "";
			this.dictionary.learn(this.key, text);
			const result = text + this.display(this.okuri);
			this.reset();
			return result;
		}
		append(text) {
			if (this.phase === "direct") this.output += this.display(text);
			else if (this.phase === "okuri") this.okuri += text;
			else this.reading += text;
		}
		convert() {
			this.append(this.romaji.flush());
			if (!this.reading) return;
			if (this.okuri) this.okuriCode = okuriLetter(this.okuri, this.okuriCode);
			this.candidates = this.dictionary.lookup(this.key);
			if (!this.candidates.length) {
				this.request = {
					key: this.key,
					reading: this.display(this.reading + this.okuri)
				};
				return;
			}
			this.phase = "candidate";
			this.index = 0;
		}
		handle(key) {
			this.output = "";
			this.request = void 0;
			return {
				handled: this.process(key),
				committed: this.output,
				...this.request ? { registration: this.request } : {}
			};
		}
		process(key) {
			if (key === "C-j") {
				this.output += this.setMode("hiragana");
				return true;
			}
			if (key === "C-g" || key === "Escape") {
				if (!this.active) return false;
				if (this.phase === "candidate") {
					this.phase = this.okuriCode ? "okuri" : "reading";
					this.candidates = [];
				} else this.reset();
				return true;
			}
			if (this.mode === "ascii") return false;
			if (key === "Backspace" || key === "C-h") {
				if (!this.active) return false;
				if (this.phase === "candidate") {
					this.phase = this.okuriCode ? "okuri" : "reading";
					this.candidates = [];
				} else if (this.romaji.pending) this.romaji.pending = this.romaji.pending.slice(0, -1);
				else if (this.okuri) this.okuri = [...this.okuri].slice(0, -1).join("");
				else if (this.okuriCode) {
					this.okuriCode = "";
					this.phase = "reading";
				} else if (this.reading) this.reading = [...this.reading].slice(0, -1).join("");
				else this.reset();
				return true;
			}
			if (key === "Enter") {
				if (!this.active) return false;
				this.output += this.finish();
				return true;
			}
			if (this.phase === "candidate") {
				if (/^[1-5]$/.test(key)) {
					const pageStart = Math.floor(this.index / 5) * 5;
					const selected = pageStart + Number(key) - 1;
					if (selected >= this.candidates.length) return true;
					this.index = selected;
					this.output += this.finish();
					return true;
				}
				if (key === " ") {
					if (this.index + 1 < this.candidates.length) this.index++;
					else this.request = {
						key: this.key,
						reading: this.display(this.reading + this.okuri)
					};
					return true;
				}
				if (key === "x") {
					if (this.index > 0) this.index--;
					else {
						this.phase = this.okuriCode ? "okuri" : "reading";
						this.candidates = [];
					}
					return true;
				}
				if (key.length !== 1) return false;
				this.output += this.finish();
			}
			if (key.length !== 1) return false;
			if (this.mode === "fullwidth") {
				this.output += fullwidth(key);
				return true;
			}
			if (this.abbrev) {
				if (key === " ") this.convert();
				else this.reading += key;
				return true;
			}
			const commandBoundary = !this.romaji.pending || this.romaji.pending === "n";
			if (key === " " && this.romaji.pending !== "z") {
				if (this.phase !== "direct") this.convert();
				else {
					this.append(this.romaji.flush());
					this.output += " ";
				}
				return true;
			}
			if (commandBoundary && key === "q") {
				this.append(this.romaji.flush());
				if (this.phase !== "direct") {
					this.output += this.mode === "katakana" ? this.reading + this.okuri : katakana(this.reading + this.okuri);
					this.reset();
				} else this.mode = this.mode === "hiragana" ? "katakana" : "hiragana";
				return true;
			}
			if (commandBoundary && this.phase === "direct" && (key === "l" || key === "L")) {
				this.append(this.romaji.flush());
				this.mode = key === "l" ? "ascii" : "fullwidth";
				return true;
			}
			if (commandBoundary && this.phase === "direct" && key === "/") {
				this.append(this.romaji.flush());
				this.phase = "reading";
				this.abbrev = true;
				return true;
			}
			if (key === ";" && commandBoundary) {
				this.append(this.romaji.flush());
				if (this.phase === "direct") this.phase = "reading";
				return true;
			}
			if (/^[A-Z]$/.test(key)) {
				if (this.phase === "direct") {
					this.append(this.romaji.flush());
					this.phase = "reading";
				} else if (this.phase === "reading" && this.reading && commandBoundary) {
					this.append(this.romaji.flush());
					this.phase = "okuri";
					this.okuriCode = key.toLowerCase();
				}
				key = key.toLowerCase();
			}
			const text = this.romaji.feed(key);
			this.append(text);
			if (this.phase === "okuri" && this.okuri && !this.romaji.pending) this.convert();
			return true;
		}
	};
	//#endregion
	//#region src/editors/shared/edit-context.ts
	function nativeContext(element) {
		const context = element.editContext;
		return context && typeof context.text === "string" ? context : null;
	}
	//#endregion
	//#region src/editors/slack/index.ts
	function isSlackComposer(element) {
		if (!element.isContentEditable) return false;
		const role = element.getAttribute("role");
		const cls = element.className;
		return role === "textbox" && typeof cls === "string" && /(?:ql-editor|c-texty_input|slack|message)/i.test(cls + " " + element.outerHTML.slice(0, 300));
	}
	function textOf(root) {
		return root.innerText ?? root.textContent ?? "";
	}
	function insertSlack(root, text) {
		root.focus();
		const bookmark = captureTextSelection(root);
		const before = new InputEvent("beforeinput", {
			bubbles: true,
			composed: true,
			cancelable: true,
			inputType: "insertText",
			data: text
		});
		if (!root.dispatchEvent(before)) return false;
		const selection = root.ownerDocument.getSelection();
		if (!selection || selection.rangeCount === 0) return false;
		const range = selection.getRangeAt(0);
		range.deleteContents();
		range.insertNode(root.ownerDocument.createTextNode(text));
		range.collapse(false);
		selection.removeAllRanges();
		selection.addRange(range);
		root.dispatchEvent(new InputEvent("input", {
			bubbles: true,
			composed: true,
			inputType: "insertText",
			data: text
		}));
		stabilizeInsertedCaret(bookmark, text.length);
		return true;
	}
	var adapter$6 = {
		kind: "slack",
		detect(element) {
			if (isSlackComposer(element)) return element;
			const candidate = element.closest('[contenteditable="true"][role="textbox"]');
			return candidate && isSlackComposer(candidate) ? candidate : null;
		},
		snapshot(root) {
			return textOf(root);
		},
		insert(element, text) {
			return insertSlack(element, text);
		}
	};
	//#endregion
	//#region src/editors/monaco/edit-context.ts
	function typeIntoEditContext(element, text) {
		const context = nativeContext(element);
		if (!context) return false;
		const updateText = context.updateText;
		context.updateText = function(start, end, value) {
			updateText.call(this, start, start === 0 ? this.text.length : end, value);
		};
		let end = context.selectionStart;
		try {
			context.dispatchEvent(new Event("compositionstart"));
			const start = context.selectionStart;
			end = start + text.length;
			const event = new Event("textupdate");
			Object.defineProperties(event, {
				text: { value: text },
				updateRangeStart: { value: start },
				updateRangeEnd: { value: context.selectionEnd },
				selectionStart: { value: end },
				selectionEnd: { value: end }
			});
			context.dispatchEvent(event);
		} finally {
			try {
				context.dispatchEvent(new Event("compositionend"));
				context.updateSelection(end, end);
			} finally {
				context.updateText = updateText;
			}
		}
		return true;
	}
	//#endregion
	//#region src/editors/native/input.ts
	function insertInput(editor, text) {
		const start = editor.selectionStart ?? 0;
		const end = editor.selectionEnd ?? start;
		const next = editor.value.slice(0, start) + text + editor.value.slice(end);
		const proto = editor instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
		Object.getOwnPropertyDescriptor(proto, "value").set.call(editor, next);
		editor.setSelectionRange(start + text.length, start + text.length);
		editor.dispatchEvent(new InputEvent("input", {
			bubbles: true,
			composed: true,
			inputType: "insertText",
			data: text
		}));
		return true;
	}
	//#endregion
	//#region src/editors/monaco/textarea.ts
	function insertTextarea(element, text) {
		return element instanceof HTMLTextAreaElement && insertInput(element, text);
	}
	//#endregion
	//#region src/editors/monaco/index.ts
	var adapter$5 = {
		kind: "monaco",
		detect(element) {
			return element.matches("textarea.inputarea, .native-edit-context") ? element.closest(".monaco-editor") : null;
		},
		snapshot(root) {
			const carets = Array.from(root.querySelectorAll(".cursor, .selected-text")).map((node) => `${node.style.top}:${node.style.left}:${node.style.width}:${node.style.height}`).join("|");
			return (root.querySelector(".view-lines")?.textContent ?? "") + "\0" + carets;
		},
		insert: (element, text) => nativeContext(element) ? typeIntoEditContext(element, text) : insertTextarea(element, text)
	};
	//#endregion
	//#region src/editors/shared/selection.ts
	function offsetAt(root, node, offset) {
		const range = root.ownerDocument.createRange();
		range.selectNodeContents(root);
		range.setEnd(node, offset);
		return range.toString().length;
	}
	function captureTextSelection(element) {
		const root = element.isContentEditable ? element : element.closest('[contenteditable]:not([contenteditable="false"])');
		if (!root) return null;
		const selection = root.ownerDocument.getSelection();
		if (!selection?.rangeCount) return null;
		const range = selection.getRangeAt(0);
		if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
		return { root, start: offsetAt(root, range.startContainer, range.startOffset), end: offsetAt(root, range.endContainer, range.endOffset), length: root.textContent?.length ?? 0 };
	}
	function pointAt(root, offset) {
		const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		let remaining = offset, node;
		while (node = walker.nextNode()) {
			const length = node.textContent?.length ?? 0;
			if (remaining <= length) return [node, remaining];
			remaining -= length;
		}
		return offset === 0 ? [root, 0] : null;
	}
	function currentOffset(root) {
		const selection = root.ownerDocument.getSelection();
		if (!selection?.rangeCount) return null;
		const range = selection.getRangeAt(0);
		if (!range.collapsed || !root.contains(range.startContainer)) return null;
		return offsetAt(root, range.startContainer, range.startOffset);
	}
	function stabilizeInsertedCaret(bookmark, insertedLength) {
		if (!bookmark) return;
		const { root } = bookmark;
		const target = bookmark.start + insertedLength;
		const expectedLength = bookmark.length - (bookmark.end - bookmark.start) + insertedLength;
		const restore = () => {
			if (!root.isConnected) return;
			const current = currentOffset(root);
			const length = root.textContent?.length ?? 0;
			if (length !== expectedLength) return;
			if (current === target || current !== length || target === length) return;
			const point = pointAt(root, target);
			if (!point) return;
			const range = root.ownerDocument.createRange();
			range.setStart(point[0], point[1]);
			range.collapse(true);
			const selection = root.ownerDocument.getSelection();
			selection?.removeAllRanges();
			selection?.addRange(range);
			root.ownerDocument.dispatchEvent(new Event("selectionchange"));
		};
		restore();
		requestAnimationFrame(restore);
	}
	//#endregion
	//#region src/editors/shared/clipboard.ts
	function pasteIntoComponent(element, text) {
		element.ownerDocument.dispatchEvent(new Event("selectionchange"));
		const selection = captureTextSelection(element);
		const data = new DataTransfer();
		data.setData("text/plain", text);
		const paste = new ClipboardEvent("paste", {
			bubbles: true,
			composed: true,
			cancelable: true
		});
		Object.defineProperty(paste, "clipboardData", { value: data });
		element.dispatchEvent(paste);
		if (paste.defaultPrevented) stabilizeInsertedCaret(selection, text.length);
		return paste.defaultPrevented;
	}
	//#endregion
	//#region src/editors/codemirror5/index.ts
	var adapter$4 = {
		kind: "codemirror5",
		detect(element) {
			if (!(element.matches("textarea") && !element.closest(".CodeMirror-dialog")) && !element.closest(".CodeMirror-code")) return null;
			return element.closest(".CodeMirror");
		},
		snapshot(root) {
			return ((root.matches(".CodeMirror-code") ? root : root.querySelector(".CodeMirror-code"))?.textContent ?? "") + "\0";
		},
		insert: pasteIntoComponent
	};
	//#endregion
	//#region src/editors/codemirror6/edit-context.ts
	function insertEditContext(element, text) {
		const context = nativeContext(element);
		if (!context) return false;
		const start = context.selectionStart, end = context.selectionEnd;
		context.dispatchEvent(new Event("compositionstart"));
		try {
			context.updateText(start, end, text);
			context.updateSelection(start + text.length, start + text.length);
			const event = new Event("textupdate");
			Object.defineProperties(event, {
				text: { value: text },
				updateRangeStart: { value: start },
				updateRangeEnd: { value: end },
				selectionStart: { value: start + text.length },
				selectionEnd: { value: start + text.length }
			});
			context.dispatchEvent(event);
		} finally {
			context.dispatchEvent(new Event("compositionend"));
		}
		return true;
	}
	//#endregion
	//#region src/editors/codemirror6/index.ts
	var adapter$3 = {
		kind: "codemirror6",
		detect(element) {
			if (!element.closest(".cm-content")) return null;
			return element.closest(".cm-editor");
		},
		snapshot(root) {
			return ((root.matches(".cm-content") ? root : root.querySelector(".cm-content"))?.textContent ?? "") + "\0";
		},
		insert: (element, text) => nativeContext(element) ? insertEditContext(element, text) : pasteIntoComponent(element, text)
	};
	//#endregion
	//#region src/editors/prosemirror/index.ts
	var adapter$2 = {
		kind: "prosemirror",
		detect(element) {
			return element.closest(".ProseMirror");
		},
		snapshot(root) {
			return ((root.matches(".ProseMirror") ? root : root.querySelector(".ProseMirror"))?.textContent ?? "") + "\0";
		},
		insert: pasteIntoComponent
	};
	//#endregion
	//#region src/editors/tiptap/index.ts
	var adapter$1 = {
		...adapter$2,
		kind: "tiptap",
		detect: (element) => element.closest(".tiptap.ProseMirror")
	};
	//#endregion
	//#region src/editors/quill/v1.ts
	function legacyInstance(element) {
		const instance = element.closest(".ql-container")?.__quill;
		return instance?.root === element && typeof instance.updateContents === "function" && typeof instance.getContents === "function" && typeof instance.history?.cutoff === "function" ? instance : null;
	}
	function insertLegacy(element, text) {
		const quill = legacyInstance(element);
		if (!quill?.isEnabled()) return false;
		const range = quill.getSelection();
		if (!range) return false;
		quill.history.cutoff();
		const delta = quill.getContents(0, 0).retain(range.index).delete(range.length).insert(text, quill.getFormat(range.index));
		quill.updateContents(delta, "user");
		quill.setSelection(range.index + text.length, 0, "silent");
		quill.history.cutoff();
		return true;
	}
	//#endregion
	//#region src/editors/registry.ts
	var adapters = [
		adapter$6,
		adapter$5,
		adapter$4,
		adapter$3,
		adapter$1,
		adapter$2,
		{
			kind: "quill",
			detect(element) {
				if (!element.closest(".ql-editor")) return null;
				return element.closest(".ql-container");
			},
			snapshot(root) {
				return ((root.matches(".ql-editor") ? root : root.querySelector(".ql-editor"))?.textContent ?? "") + "\0";
			},
			insert: (element, text) => legacyInstance(element) ? insertLegacy(element, text) : pasteIntoComponent(element, text)
		}
	];
	function componentFor(element) {
		for (const adapter of adapters) {
			const root = adapter.detect(element);
			if (root) return {
				kind: adapter.kind,
				root,
				adapter
			};
		}
		return null;
	}
	function componentSnapshot(element) {
		const component = componentFor(element);
		return component ? component.adapter.snapshot(component.root) : "";
	}
	//#endregion
	//#region src/editors/native/contenteditable.ts
	function insertContenteditable(editor, text, range, selection) {
		selection?.removeAllRanges();
		selection?.addRange(range);
		if (document.execCommand("insertText", false, text)) return true;
		range.deleteContents();
		const node = document.createTextNode(text);
		range.insertNode(node);
		range.setStartAfter(node);
		range.collapse(true);
		selection?.removeAllRanges();
		selection?.addRange(range);
		editor.dispatchEvent(new InputEvent("input", {
			bubbles: true,
			composed: true,
			inputType: "insertText",
			data: text
		}));
		return true;
	}
	//#endregion
	//#region src/editors/native/index.ts
	function findEditor(path) {
		if (path.some((item) => item instanceof HTMLElement && item.matches("[data-skk-disable]"))) return null;
		for (const item of path) {
			if (!(item instanceof HTMLElement)) continue;
			if (item.closest("[data-skk-disable]")) return null;
			if (componentFor(item)?.kind === "monaco" && item.getAttribute("aria-autocomplete") === "none") return null;
			if (item instanceof HTMLTextAreaElement) return item.disabled || item.readOnly ? null : item;
			if (item instanceof HTMLInputElement) return ["text", "search"].includes(item.type) && !item.disabled && !item.readOnly ? item : null;
			if (item.closest("[contenteditable=\"false\"]")) return null;
			if (nativeContext(item) && componentFor(item)?.kind === "monaco") return item;
			if (item.isContentEditable) {
				let root = item;
				while (root.parentElement?.isContentEditable) root = root.parentElement;
				return root;
			}
		}
		return null;
	}
	//#endregion
	//#region src/editor.ts
	function selectionFor(editor) {
		const root = editor.getRootNode();
		return "getSelection" in root && root.getSelection ? root.getSelection() : document.getSelection();
	}
	var Bookmark = class {
		value;
		start = 0;
		end = 0;
		range = null;
		componentState;
		editor;
		constructor(editor) {
			this.editor = editor;
			this.componentState = componentSnapshot(editor);
			const context = nativeContext(editor);
			if (context) {
				this.value = context.text;
				this.start = context.selectionStart;
				this.end = context.selectionEnd;
			} else if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) {
				this.value = editor.value;
				this.start = editor.selectionStart ?? 0;
				this.end = editor.selectionEnd ?? this.start;
			} else {
				this.value = editor.textContent ?? "";
				const selection = selectionFor(editor);
				if (selection?.rangeCount) {
					const range = selection.getRangeAt(0);
					if (editor.contains(range.commonAncestorContainer)) this.range = range.cloneRange();
				}
			}
		}
		valid() {
			const editor = this.editor;
			if (!editor.isConnected) return false;
			if (componentSnapshot(editor) !== this.componentState) return false;
			const context = nativeContext(editor);
			if (context) return context.text === this.value && context.selectionStart === this.start && context.selectionEnd === this.end;
			if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) return !editor.disabled && !editor.readOnly && editor.value === this.value && editor.selectionStart === this.start && editor.selectionEnd === this.end;
			if (!editor.isContentEditable || (editor.textContent ?? "") !== this.value || !this.range) return false;
			const selection = selectionFor(editor);
			if (!selection?.rangeCount) return false;
			const current = selection.getRangeAt(0);
			return current.startContainer === this.range.startContainer && current.startOffset === this.range.startOffset && current.endContainer === this.range.endContainer && current.endOffset === this.range.endOffset;
		}
		restoreFocus() {
			const editor = this.editor;
			if (!editor.isConnected) return false;
			const component = componentFor(editor);
			if (component && componentSnapshot(editor).split("\0")[0] !== this.componentState.split("\0")[0]) return false;
			const context = nativeContext(editor);
			if (context) {
				if (context.text !== this.value) return false;
				editor.focus();
				context.updateSelection(this.start, this.end);
				return true;
			}
			if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) {
				if (editor.disabled || editor.readOnly || !component && editor.value !== this.value) return false;
				editor.focus();
				editor.setSelectionRange(this.start, this.end);
				return true;
			}
			if (!editor.isContentEditable || editor.textContent !== this.value || !this.range?.startContainer.isConnected || !this.range.endContainer.isConnected) return false;
			editor.focus();
			const selection = selectionFor(editor);
			selection?.removeAllRanges();
			selection?.addRange(this.range.cloneRange());
			editor.ownerDocument.dispatchEvent(new Event("selectionchange"));
			return true;
		}
		insert(text) {
			if (!this.valid()) return false;
			if (!text) return true;
			const editor = this.editor;
			const component = componentFor(editor);
			if (component) return component.adapter.insert(editor, text);
			const before = new InputEvent("beforeinput", {
				bubbles: true,
				composed: true,
				cancelable: true,
				inputType: "insertText",
				data: text
			});
			if (!editor.dispatchEvent(before) || !this.valid()) return false;
			if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) return insertInput(editor, text);
			return insertContenteditable(editor, text, this.range, selectionFor(editor));
		}
	};
	//#endregion
	//#region src/starter-dictionary.ts
	var starterDictionary = `;; Original starter entries, MIT license, UTF-8
にほん /日本/二本/
にほんご /日本語/
とうきょう /東京/
かな /仮名/かな/
かんじ /漢字/感じ/幹事/
へんかん /変換/返還/
じしょ /辞書/
にゅうりょく /入力/
きょう /今日/京/教/
あした /明日/
きのう /昨日/機能/
わたし /私/
あなた /貴方/
なまえ /名前/
ことば /言葉/
けんきゅう /研究/
ろんり /論理/
すうがく /数学/
じょうほう /情報/
げんご /言語/
ていり /定理/
しょうめい /証明/
ろんぶん /論文/
だいがく /大学/
がくせい /学生/
せんせい /先生/
がっこう /学校/
じかん /時間/
でんしゃ /電車/
えき /駅/
ほん /本/
ひと /人/
ねこ /猫/
いぬ /犬/
やま /山/
かわ /川/
そら /空/
あめ /雨/飴/
はな /花/鼻/
みず /水/
おちゃ /お茶/
にちようび /日曜日/
げつようび /月曜日/
かようび /火曜日/
すいようび /水曜日/
もくようび /木曜日/
きんようび /金曜日/
どようび /土曜日/
かk /書/描/欠/
よm /読/詠/
おくr /送/贈/
たべr /食べ/
いk /行/逝/
おもu /思/想/
あu /会/合/遭/
みr /見/観/
はなs /話/放/
つかu /使/遣/
つくr /作/造/
わかr /分か/判/
うれs /嬉/
たのs /楽/
おおk /大/
ちいs /小/
あたらs /新/
ふるi /古/
たかi /高/
やすi /安/
はやi /早/速/
skk /SKK;Simple Kana to Kanji conversion/
ime /IME;Input Method Editor/
`;
	//#endregion
	//#region src/ui.ts
	var labels = {
		ascii: "A",
		hiragana: "あ",
		katakana: "ア",
		fullwidth: "Ａ"
	};
	var UI = class {
		host = document.createElement("div");
		root;
		panel;
		settings;
		status = "";
		modeNotice = false;
		lastMode = "ascii";
		modeTimer;
		statusTimer;
		refresh = () => {};
		constructor(onToggle) {
			this.host.style.cssText = "all:initial;font:14px/1.5 system-ui,sans-serif;color:#182331;color-scheme:light;position:fixed;inset:0;pointer-events:none;z-index:2147483647";
			this.root = this.host.attachShadow({ mode: "closed" });
			const style = document.createElement("style");
			style.textContent = `
      :host{font:14px/1.5 system-ui,sans-serif;color:#182331;color-scheme:light}
      *{box-sizing:border-box}button,input,select{font:inherit}
      button{cursor:pointer;background:#eef3f8;border:1px solid #b6c5d6;border-radius:5px;padding:4px 9px;color:#182331}
      button:hover{background:#dce9f6}button:focus-visible{outline:2px solid #146cbd}
      .panel{position:fixed;max-width:min(320px,calc(100vw - 16px));overflow:hidden;background:#fff;
        border:1px solid #9caec1;box-shadow:0 3px 16px #0002;border-radius:5px;padding:4px 6px;pointer-events:auto}
      .head{display:flex;gap:6px;align-items:center;min-width:0}.head button{flex:none;padding:0 4px;font-size:12px;line-height:20px}
      .preedit{font-size:14px;line-height:22px;white-space:pre;overflow:hidden;text-overflow:ellipsis}
      .candidates{margin-top:2px;display:flex;gap:3px;overflow-x:auto;scrollbar-width:none}
      .candidates::-webkit-scrollbar{display:none}.candidates button{flex:none;padding:0 5px;line-height:22px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.selected{background:#146cbd;color:white}
      .status{max-width:100%;font-size:12px;line-height:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .note{color:#536476;font-size:12px;margin-top:5px;max-width:480px}
      .backdrop{position:fixed;inset:0;background:#0005;pointer-events:auto;display:grid;place-items:center}
      .dialog{background:white;border-radius:10px;padding:24px;width:min(590px,95vw);max-height:90vh;overflow:auto}
      h2{margin:0 0 12px;font-size:20px}p{margin:10px 0}label{display:block;margin:12px 0}
      input[type=text]{width:100%;padding:8px;border:1px solid #9caec1;border-radius:5px}
      .actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}[hidden]{display:none!important}
    `;
			this.root.append(style);
			this.panel = document.createElement("div");
			this.panel.className = "panel";
			this.panel.hidden = true;
			this.panel.addEventListener("pointerdown", (e) => e.preventDefault());
			this.panel.addEventListener("click", (e) => {
				if (e.target.closest("[data-toggle]")) onToggle();
			});
			this.settings = document.createElement("div");
			this.settings.className = "backdrop";
			this.settings.hidden = true;
			this.root.append(this.panel, this.settings);
			document.documentElement.append(this.host);
		}
		message(text) {
			this.status = text;
			clearTimeout(this.statusTimer);
			this.statusTimer = setTimeout(() => {
				this.status = "";
				this.refresh();
			}, 3500);
		}
		render(engine, editor, choose) {
			this.refresh = () => this.render(engine, editor, choose);
			if (engine.mode !== this.lastMode) {
				this.lastMode = engine.mode;
				this.modeNotice = true;
				clearTimeout(this.modeTimer);
				this.modeTimer = setTimeout(() => {
					this.modeNotice = false;
					this.refresh();
				}, 800);
			}
			this.panel.hidden = !editor || !this.settings.hidden || !(engine.active || this.modeNotice || this.status);
			if (!editor || this.panel.hidden) return;
			this.panel.replaceChildren();
			const head = document.createElement("div");
			head.className = "head";
			const badge = document.createElement("button");
			badge.dataset.toggle = "";
			badge.textContent = "SKK " + labels[engine.mode];
			badge.title = "Toggle SKK: Ctrl+Shift+Space";
			const preedit = document.createElement("span");
			preedit.className = "preedit";
			preedit.textContent = engine.preedit;
			preedit.title = engine.preedit;
			preedit.setAttribute("aria-live", "polite");
			head.append(badge, preedit);
			this.panel.append(head);
			if (engine.phase === "candidate") {
				const candidates = document.createElement("div");
				candidates.className = "candidates";
				const start = Math.floor(engine.index / 5) * 5;
				engine.candidates.slice(start, start + 5).forEach((candidate, offset) => {
					const button = document.createElement("button");
					button.textContent = `${offset + 1}. ${candidate.text}${engine.display(engine.okuri)}`;
					button.title = `${candidate.text}${engine.display(engine.okuri)}${candidate.annotation ? " — " + candidate.annotation : ""}`;
					button.classList.toggle("selected", start + offset === engine.index);
					button.setAttribute("aria-pressed", String(start + offset === engine.index));
					button.addEventListener("click", () => choose(start + offset));
					candidates.append(button);
				});
				this.panel.append(candidates);
				const selected = candidates.querySelector(".selected");
				if (selected) candidates.scrollLeft = Math.max(0, selected.offsetLeft - candidates.offsetLeft - (candidates.clientWidth - selected.offsetWidth) / 2);
			}
			if (this.status && !engine.active) {
				const note = document.createElement("span");
				note.className = "status";
				note.textContent = this.status;
				note.title = this.status;
				note.setAttribute("role", "status");
				preedit.replaceWith(note);
			}
			const rect = (componentFor(editor)?.root ?? editor).getBoundingClientRect();
			this.panel.style.left = Math.max(8, Math.min(rect.left, innerWidth - this.panel.offsetWidth - 8)) + "px";
			const height = this.panel.offsetHeight;
			const bottom = rect.bottom + 5;
			this.panel.style.top = Math.max(8, bottom + height < innerHeight ? bottom : Math.min(rect.top - height - 5, innerHeight - height - 8)) + "px";
		}
		dialog(title) {
			this.settings.replaceChildren();
			this.settings.hidden = false;
			this.panel.hidden = true;
			const dialog = document.createElement("div");
			dialog.className = "dialog";
			dialog.setAttribute("role", "dialog");
			dialog.setAttribute("aria-modal", "true");
			const heading = document.createElement("h2");
			heading.textContent = title;
			dialog.append(heading);
			this.settings.append(dialog);
			return dialog;
		}
		close() {
			this.settings.hidden = true;
		}
	};
	//#endregion
	//#region src/resource.ts
	async function loadResourceDictionary(getResourceURL = (name, isBlobUrl) => GM_getResourceURL(name, isBlobUrl)) {
		try {
			const url = await getResourceURL("SKK_JISYO_L", false);
			let bytes;
			const data = /^data:[^,]*;base64,(.*)$/s.exec(url);
			if (data) {
				const binary = atob(data[1]);
				bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
			} else {
				if (!url.startsWith("blob:") && !url.startsWith("data:")) throw new Error("Missing cached dictionary resource");
				const response = await fetch(url, { signal: AbortSignal.timeout(5e3) });
				if (!response.ok) throw new Error("Cannot read cached dictionary resource");
				bytes = new Uint8Array(await response.arrayBuffer());
			}
			const dictionary = new Dictionary(new TextDecoder("euc-jp", { fatal: true }).decode(bytes));
			if (!dictionary.base.size) throw new Error("Empty dictionary resource");
			return dictionary;
		} catch (error) {
			console.warn("SKK-JISYO.L resource unavailable; using starter dictionary:", error);
			return null;
		}
	}
	function mergeDictionaries(...dictionaries) {
		const base = /* @__PURE__ */ new Map();
		for (const dictionary of dictionaries) for (const [key, candidates] of dictionary.base) {
			const previous = base.get(key) ?? [];
			base.set(key, [...previous, ...candidates.filter((candidate) => !previous.some((item) => item.text === candidate.text))]);
		}
		return base;
	}
	//#endregion
	//#region src/userscript.ts
	var SOURCE_KEY = "skk.dictionary.v1";
	var USER_KEY = "skk.user.v1";
	async function main() {
		const [source, user, resource] = await Promise.all([
			GM_getValue(SOURCE_KEY, ""),
			GM_getValue(USER_KEY, {}),
			loadResourceDictionary()
		]);
		const starter = new Dictionary(starterDictionary);
		const defaults = resource ? mergeDictionaries(resource, starter) : starter.base;
		const defaultDictionary = new Dictionary();
		defaultDictionary.base = defaults;
		const dictionary = new Dictionary("", user);
		dictionary.base = mergeDictionaries(new Dictionary(typeof source === "string" ? source : ""), defaultDictionary);
		const engine = new Engine(dictionary);
		let editor = null;
		let bookmark = null;
		let nativeComposition = false;
		let registering = false;
		let writing = false;
		let normalizing = false;
		let normalizationId = 0;
		const watchedContexts = /* @__PURE__ */ new WeakSet();
		let saveQueue = Promise.resolve();
		let savedRevision = 0;
		const ui = new UI(toggle);
		function save() {
			if (dictionary.revision === savedRevision) return;
			savedRevision = dictionary.revision;
			const snapshot = JSON.parse(JSON.stringify(dictionary.user));
			saveQueue = saveQueue.then(() => GM_setValue(USER_KEY, snapshot)).catch(() => {
				savedRevision = -1;
				ui.message("学習結果を保存できませんでした。");
				render();
			});
		}
		function render() {
			ui.render(engine, editor, (index) => {
				engine.index = index;
				commit(engine.finish());
				save();
				render();
			});
		}
		function normalize(target) {
			if (!componentFor(target)) return;
			const id = ++normalizationId;
			normalizing = true;
			const normalized = () => {
				if (id !== normalizationId || editor !== target) return;
				bookmark = new Bookmark(target);
				normalizing = false;
			};
			requestAnimationFrame(normalized);
		}
		function watchNative(target) {
			const context = nativeContext(target);
			if (!context || watchedContexts.has(context)) return;
			watchedContexts.add(context);
			context.addEventListener("textupdate", () => {
				if (writing || editor !== target) return;
				engine.reset();
				bookmark = null;
				normalize(target);
				render();
			});
			context.addEventListener("compositionstart", () => {
				if (writing || editor !== target) return;
				settle();
				nativeComposition = true;
			});
			context.addEventListener("compositionend", () => {
				if (writing || editor !== target) return;
				nativeComposition = false;
				normalize(target);
			});
		}
		function commit(text) {
			if (!text) return true;
			if (normalizing && editor) bookmark = new Bookmark(editor);
			writing = true;
			let inserted = false;
			try {
				inserted = bookmark?.insert(text) ?? false;
			} finally {
				writing = false;
			}
			if (!inserted) {
				engine.reset();
				ui.message("入力位置が変わったため変換を取り消しました。");
			}
			bookmark = editor ? new Bookmark(editor) : null;
			if (inserted && editor) normalize(editor);
			return inserted;
		}
		function settle() {
			if (engine.active) {
				commit(engine.finish());
				save();
			}
			engine.reset();
			bookmark = null;
			normalizing = false;
			normalizationId++;
		}
		function toggle() {
			if (registering) return;
			commit(engine.setMode(engine.mode === "ascii" ? "hiragana" : "ascii"));
			save();
			render();
		}
		function button(label, fn) {
			const element = document.createElement("button");
			element.textContent = label;
			element.addEventListener("click", fn);
			return element;
		}
		function register(key, reading) {
			registering = true;
			const original = editor;
			const originalBookmark = bookmark;
			const dialog = ui.dialog(`単語登録: ${key}`);
			const description = document.createElement("p");
			description.textContent = `${reading} の漢字部分を入力してください。送り仮名は自動で付加します。OS の IME または貼り付けを使用できます。`;
			const input = document.createElement("input");
			input.type = "text";
			input.autocomplete = "off";
			input.setAttribute("aria-label", "登録する単語");
			const note = document.createElement("p");
			note.className = "note";
			const actions = document.createElement("div");
			actions.className = "actions";
			const close = (accept) => {
				if (accept && (!input.value || /[\r\n/;]/.test(input.value) || input.value.length > 1e3)) {
					note.textContent = "空文字、改行、/、; は登録できません。";
					return;
				}
				ui.close();
				const restored = originalBookmark?.restoreFocus() ?? false;
				if (restored && original) bookmark = new Bookmark(original);
				else {
					original?.focus();
					engine.reset();
					ui.message("登録中に入力位置が変わったため変換を取り消しました。");
				}
				registering = false;
				if (accept && restored) {
					commit(engine.register(input.value));
					save();
				}
				render();
			};
			actions.append(button("登録", () => close(true)), button("取消", () => close(false)));
			input.addEventListener("keydown", (e) => {
				if (e.isComposing) return;
				if (e.key === "Enter") {
					e.preventDefault();
					close(true);
				}
				if (e.key === "Escape") {
					e.preventDefault();
					close(false);
				}
			});
			dialog.append(description, input, note, actions);
			input.focus();
		}
		function download(name, text) {
			const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = name;
			anchor.click();
			setTimeout(() => URL.revokeObjectURL(url), 1e3);
		}
		function settings() {
			settle();
			const original = editor;
			const dialog = ui.dialog("SKK 辞書設定");
			const text = document.createElement("p");
			text.textContent = `現在 ${dictionary.base.size.toLocaleString()} 見出し、登録・学習 ${Object.keys(dictionary.user).length.toLocaleString()} 見出し。${resource ? "SKK-JISYO.L を使用中。" : "SKK-JISYO.L を読み込めなかったため内蔵小辞書を使用中。"}追加辞書をローカルから読み込めます。入力内容の送信は行いません。`;
			const encoding = document.createElement("select");
			for (const [value, label] of [
				["auto", "自動判定 (UTF-8 → EUC-JP)"],
				["utf-8", "UTF-8"],
				["euc-jp", "EUC-JP"]
			]) {
				const option = document.createElement("option");
				option.value = value;
				option.textContent = label;
				encoding.append(option);
			}
			const input = document.createElement("input");
			input.type = "file";
			input.setAttribute("aria-label", "SKK 辞書ファイル");
			const message = document.createElement("p");
			message.className = "note";
			message.setAttribute("role", "status");
			input.addEventListener("change", () => {
				(async () => {
					const file = input.files?.[0];
					if (!file) return;
					if (file.size > 33554432) {
						message.textContent = "32 MiB 以下の辞書を選択してください。";
						return;
					}
					try {
						message.textContent = "辞書を読み込み中…";
						const bytes = await file.arrayBuffer();
						let source;
						if (encoding.value === "auto") try {
							source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
						} catch {
							source = new TextDecoder("euc-jp", { fatal: true }).decode(bytes);
						}
						else source = new TextDecoder(encoding.value, { fatal: true }).decode(bytes);
						const imported = new Dictionary(source);
						if (!imported.base.size) throw new Error("SKK 形式の見出しが見つかりません。");
						await GM_setValue(SOURCE_KEY, source);
						dictionary.base = mergeDictionaries(imported, defaultDictionary);
						message.textContent = `${file.name}: ${imported.base.size.toLocaleString()} 見出しを保存しました。以前の取込辞書を置換しました。`;
					} catch (error) {
						message.textContent = `読込失敗: ${error instanceof Error ? error.message : String(error)}`;
					}
				})();
			});
			const actions = document.createElement("div");
			actions.className = "actions";
			actions.append(button("登録・学習辞書をエクスポート", () => download("SKK-JISYO.userscript", dictionary.exportUser())), button("閉じる", () => {
				ui.close();
				original?.focus();
				render();
			}));
			const help = document.createElement("p");
			help.className = "note";
			help.textContent = "Ctrl+Shift+Space: 有効／無効 · Ctrl+J: ひらがな · q: カタカナ · l: 英数 · L: 全角英数 · /: 略語変換。新しい辞書は次回読込時から他のタブにも反映されます。";
			const fileLabel = document.createElement("label");
			fileLabel.textContent = "辞書ファイル ";
			fileLabel.append(input);
			const encodingLabel = document.createElement("label");
			encodingLabel.textContent = "文字コード ";
			encodingLabel.append(encoding);
			dialog.append(text, encodingLabel, fileLabel, message, help, actions);
			encoding.focus();
		}
		GM_registerMenuCommand("SKK: 辞書設定 / Dictionary settings", settings);
		GM_registerMenuCommand("SKK: 入力切替 / Toggle input", toggle);
		GM_registerMenuCommand("SKK: 登録・学習辞書をエクスポート", () => download("SKK-JISYO.userscript", dictionary.exportUser()));
		document.addEventListener("focusin", (e) => {
			if (!ui.settings.hidden) return;
			const next = findEditor(e.composedPath());
			if (next !== editor) {
				settle();
				editor = next;
			}
			bookmark = editor ? new Bookmark(editor) : null;
			render();
			if (editor) {
				watchNative(editor);
				normalize(editor);
			}
		}, true);
		document.addEventListener("focusout", () => {
			if (registering) return;
			settle();
			editor = null;
			render();
		}, true);
		document.addEventListener("compositionstart", () => {
			if (!ui.settings.hidden) return;
			settle();
			nativeComposition = true;
		}, true);
		document.addEventListener("compositionend", () => {
			nativeComposition = false;
		}, true);
		document.addEventListener("input", (e) => {
			if (!writing && findEditor(e.composedPath()) === editor) {
				engine.reset();
				bookmark = null;
				if (editor) normalize(editor);
				render();
			}
		}, true);
		document.addEventListener("pointerdown", (e) => {
			if (ui.settings.hidden && findEditor(e.composedPath()) === editor) {
				settle();
				if (editor) normalize(editor);
				render();
			}
		}, true);
		document.addEventListener("paste", () => {
			if (!writing && ui.settings.hidden) {
				settle();
				render();
			}
		}, true);
		document.addEventListener("cut", () => {
			if (ui.settings.hidden) {
				settle();
				render();
			}
		}, true);
		document.addEventListener("keydown", (e) => {
			if (!ui.settings.hidden || nativeComposition || e.isComposing || e.keyCode === 229) return;
			const target = findEditor(e.composedPath());
			if (!target) return;
			if (target !== editor) {
				settle();
				editor = target;
				bookmark = null;
			}
			watchNative(target);
			if (bookmark && !bookmark.valid() && !normalizing) {
				engine.reset();
				bookmark = null;
			}
			bookmark ??= new Bookmark(editor);
			if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.code === "Space") {
				e.preventDefault();
				e.stopImmediatePropagation();
				toggle();
				return;
			}
			const key = e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && [
				"j",
				"g",
				"h"
			].includes(e.key.toLowerCase()) ? "C-" + e.key.toLowerCase() : e.key;
			if (e.altKey || e.metaKey || e.ctrlKey && !key.startsWith("C-")) {
				if (engine.active) {
					if (e.key.toLowerCase() === "z") {
						engine.reset();
						bookmark = null;
					} else settle();
				}
				render();
				return;
			}
			const result = engine.handle(key);
			if (result.handled) {
				e.preventDefault();
				e.stopImmediatePropagation();
				if (commit(result.committed)) {
					if (result.committed) save();
					if (result.registration) register(result.registration.key, result.registration.reading);
				}
			} else if (engine.active && [
				"ArrowLeft",
				"ArrowRight",
				"ArrowUp",
				"ArrowDown",
				"Home",
				"End",
				"PageUp",
				"PageDown",
				"Tab",
				"Delete"
			].includes(e.key)) settle();
			if (!result.handled && [
				"ArrowLeft",
				"ArrowRight",
				"ArrowUp",
				"ArrowDown",
				"Home",
				"End",
				"PageUp",
				"PageDown",
				"Delete"
			].includes(e.key)) {
				bookmark = null;
				normalize(target);
			}
			render();
		}, true);
		editor = document.activeElement ? findEditor([document.activeElement]) : null;
		bookmark = editor ? new Bookmark(editor) : null;
		render();
		if (editor) watchNative(editor);
		window.addEventListener("resize", render);
		document.addEventListener("scroll", render, true);
	}
	main().catch((error) => console.error("SKK userscript initialization failed:", error));
	//#endregion
})();
