import json,html
R=json.load(open("results.json"));P=json.load(open("probe_raw.json"));S=R["summary"]
E=html.escape
LBL={"argon_default":("Argon, default","thinking on (normal)"),"argon_enable_thinking_false":("Argon, enable_thinking=false","tried to switch thinking off"),"argon_effort_minimal":("Argon, effort=minimal","thinking turned way down"),"flash_3.8_default":("Gemini 3.8 Flash","the smaller, cheaper model")}
COL={"argon_default":"#ffc94a","argon_enable_thinking_false":"#ff9e3d","argon_effort_minimal":"#2de2ff","flash_3.8_default":"#8b5cf6"}
def bars(title,kid,key,fmt,unit=""):
  vals={a:s[key] for a,s in S.items()};mx=max(vals.values()) or 1
  rows="".join(f'<div class=row><div class=lab>{E(LBL[a][0])}</div><div class=track><div class=fill style="width:{max(2,v/mx*100):.1f}%;background:{COL[a]}"></div></div><div class=val>{fmt(v)}{unit}</div></div>' for a,v in vals.items())
  return f'<section class=card><h3>{title}</h3><p class=kid>{kid}</p>{rows}</section>'
acc=bars("Accuracy","How many of the 40 math problems each one got right.","correct",lambda v:f"{v}/40")
rt=bars("Avg reasoning tokens","Thinking tokens: the hidden scratch work the model writes before answering.","mean_reasoning_tokens",str)
lat=bars("Median latency","Latency: how long you wait for an answer. Median means the middle run.","median_latency_s",lambda v:f"{v:.2f}"," s")
cost=bars("Total cost for 40 problems","What it cost on OpenRouter, in US dollars.","total_cost_usd",lambda v:f"${v:.3f}")
NAME={"default":"(no extra params)","effort_none":"reasoning.effort=none","reasoning_enabled_false":"reasoning.enabled=false","enable_thinking_false":"enable_thinking=false","effort_minimal":"reasoning.effort=minimal"}
order=["default","effort_none","reasoning_enabled_false","enable_thinking_false","effort_minimal"]
pr=""
for k in order:
  v=P[k];ok=v["http"]==200
  rtok=(v["usage"].get("completion_tokens_details") or {}).get("reasoning_tokens") if ok else None
  note="turned off" if ok and rtok==0 else ("ignored, still thinking" if k=="enable_thinking_false" else ("thinking on" if ok else E(v["error"]["message"])))
  pr+=f'<div class=prow><code>{E(NAME[k])}</code><span class="badge {"ok" if ok else "bad"}">{"200 OK" if ok else "400 error"}</span><span class=rt>{"" if rtok is None else str(rtok)+" thinking tokens"}</span><span class=note>{note}</span></div>'
d=S["argon_default"]["mean_reasoning_tokens"];e=S["argon_enable_thinking_false"]["mean_reasoning_tokens"];m=S["argon_effort_minimal"]["mean_reasoning_tokens"]
ids=", ".join(map(str,R["item_ids"]))
page=f'''<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Can you turn off Gemini 4 Argon's thinking on OpenRouter? | NeuralLoot</title>
<meta name=description content="A small test of Gemini 4 Argon thinking settings on OpenRouter, 40 hard GSM8K problems.">
<link rel=icon href="/favicon.svg" type="image/svg+xml"><link rel=canonical href="https://neuralloot.github.io/tests/2026-10-13-argon-openrouter/">
<style>
@font-face{{font-family:"Space Grotesk";src:url(/assets/fonts/space-grotesk.woff2) format("woff2");font-weight:300 700;font-display:swap}}
@font-face{{font-family:"JetBrains Mono";src:url(/assets/fonts/jetbrains-mono.woff2) format("woff2");font-weight:100 800;font-display:swap}}
:root{{--bg:#07070c;--card:#100f19;--line:rgba(255,255,255,.08);--line2:rgba(255,255,255,.14);--ink:#f5f2ea;--muted:#a3a0b0;--dim:#6f6c7d;--gold:#ffc94a;--cyan:#2de2ff;--grad:linear-gradient(100deg,#fff6dc 0%,#ffd36b 30%,#ff9e3d 55%,#ff2e88 85%);--display:"Space Grotesk",system-ui,sans-serif;--mono:"JetBrains Mono",ui-monospace,monospace}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 var(--display)}}
main{{max-width:880px;margin:auto;padding:20px 16px 48px}}a{{color:var(--cyan)}}
.top a{{font-weight:700;text-decoration:none;color:var(--ink);letter-spacing:.02em}}
h1{{font-size:clamp(26px,7vw,42px);line-height:1.1;margin:18px 0 10px;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}}
.lede{{color:var(--muted);margin:0 0 18px}}
.hero{{border:1px solid var(--line2);border-radius:18px;padding:16px;background:linear-gradient(180deg,#171425,#100f19);margin-bottom:18px}}
.hero b{{font-size:19px;display:block;margin-bottom:6px}}.hero p{{margin:0;color:var(--muted)}}
.grid{{display:grid;gap:14px}}@media(min-width:760px){{.grid{{grid-template-columns:1fr 1fr}}}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;min-width:0}}
h2{{font-size:22px;margin:28px 0 10px}}h3{{margin:0 0 4px;font-size:17px}}.kid{{color:var(--muted);font-size:14px;margin:0 0 12px}}
.row{{display:grid;grid-template-columns:1fr auto;gap:2px 10px;margin:10px 0}}.lab{{font-size:13px;color:var(--muted);grid-column:1/3}}
.track{{height:14px;background:rgba(255,255,255,.06);border-radius:7px;overflow:hidden;align-self:center}}.fill{{height:100%;border-radius:7px}}
.val{{font:600 14px var(--mono);min-width:64px;text-align:right}}
.prow{{display:grid;grid-template-columns:1fr auto;gap:4px 10px;padding:10px 0;border-top:1px solid var(--line)}}.prow:first-of-type{{border-top:0}}
.prow code{{font:13px var(--mono);word-break:break-all}}.badge{{font:700 12px var(--mono);padding:3px 8px;border-radius:999px;height:fit-content;justify-self:end;white-space:nowrap}}
.ok{{background:rgba(52,211,153,.15);color:#34d399}}.bad{{background:rgba(255,46,136,.15);color:#ff6aa8}}
.rt{{font:13px var(--mono);color:var(--gold)}}.note{{font-size:13px;color:var(--muted);grid-column:1/3}}
.callout{{border-left:3px solid var(--gold);padding:12px 14px;background:var(--card);border-radius:0 14px 14px 0;margin:14px 0}}.limits{{border-color:#ff2e88}}
.callout h3{{margin-bottom:6px}}.callout ul{{margin:0;padding-left:18px}}.callout li{{margin:4px 0}}
dl.terms{{display:grid;gap:10px}}dl.terms div{{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px}}dt{{font-weight:700}}dd{{margin:2px 0 0;color:var(--muted);font-size:14px}}
details{{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:14px 16px;margin-top:22px}}summary{{cursor:pointer;font-weight:700}}
details p,details li{{font-size:14px;color:var(--muted)}}details code{{font:12.5px var(--mono);color:var(--ink);word-break:break-word}}
footer{{margin-top:30px;color:var(--dim);font-size:13px}}
</style></head><body><main>
<div class=top><a href="/">NeuralLoot</a></div>
<h1>Can you turn off Gemini 4 Argon's thinking on OpenRouter?</h1>
<p class=lede>A small test, run Oct 13 2026, after a public claim about Argon's thinking settings. We checked the settings ourselves and ran 40 hard math problems.</p>
<div class=hero><b>Setting enable_thinking=false does nothing on OpenRouter: Argon still averaged {e} thinking tokens per problem, the same as default ({d}).</b>
<p>Kid version: the "stop thinking" switch isn't wired up. The model keeps doing its scratch work anyway. The switch that does work is effort=minimal, which cut thinking to {m} tokens.</p></div>
<h2>Settings test</h2><section class=card><p class=kid>One tiny prompt ("17*23") sent to google/gemini-4-argon with each setting. Green means accepted, red means rejected.</p>{pr}</section>
<h2>40 hard math problems</h2><div class=grid>{acc}{rt}{lat}{cost}</div>
<div class=callout><h3>What this shows</h3><ul>
<li>You can't fully switch Argon's thinking off here: effort=none and reasoning.enabled=false are refused with an error.</li>
<li>enable_thinking=false is accepted but ignored. Its tokens and cost match the default run.</li>
<li>effort=minimal is the real "low thinking" switch: {m} thinking tokens on average vs {d}, and it still got {S["argon_effort_minimal"]["correct"]}/40.</li>
<li>Gemini 3.8 Flash got {S["flash_3.8_default"]["correct"]}/40 and was the cheapest overall.</li></ul></div>
<div class="callout limits"><h3>Limits</h3><ul>
<li>N=40 problems. One problem is 2.5 points.</li><li>The test is too easy to rank these models: three setups scored 40/40.</li>
<li>One run each, temperature 0. No repeats, so no error bars.</li><li>Settings test used a single prompt per setting.</li></ul></div>
<h2>Words, decoded</h2><dl class=terms>
<div><dt>Reasoning tokens</dt><dd>The model's hidden scratch work before it answers. More tokens, more thinking, more cost.</dd></div>
<div><dt>GSM8K</dt><dd>A public set of grade-school word problems. We picked the 40 with the most steps.</dd></div>
<div><dt>Median latency</dt><dd>The middle wait time across 40 tries. Half were faster, half slower.</dd></div>
<div><dt>Temperature 0</dt><dd>Tells the model to pick its most likely answer, instead of being creative.</dd></div>
<div><dt>HTTP 400</dt><dd>The server's way of saying "I won't do that request."</dd></div></dl>
<details><summary>🤓 Nerd notes</summary>
<p><b>Method.</b> {E(R["suite"])}. Gold steps counted as <code>&lt;&lt;calc&gt;&gt;</code> annotations in the answer. Prompt asks for a final <code>ANSWER: n</code> line; numeric match. temperature 0, seed 20261013, max_tokens 16000, via openrouter.ai/api/v1/chat/completions. All 160 calls returned answers with no errors.</p>
<p><b>Models.</b> <code>google/gemini-4-argon</code> ($2 / $10 per million input / output tokens) and <code>google/gemini-3.8-flash</code> ($0.75 / $3.75), from the public /api/v1/models list on Oct 13 2026. Costs are OpenRouter's reported per-call cost.</p>
<p><b>Total spend.</b> ${R["total_cost_usd"]:.2f} for the eval.</p>
<p><b>Item IDs</b> (0-indexed lines of GSM8K test.jsonl): <code>{ids}</code></p>
<p><b>Files.</b> <a href=raw_outputs.jsonl>raw_outputs.jsonl</a> · <a href=results.json>results.json</a> · <a href=items.json>items.json</a> · <a href=probe_raw.json>probe_raw.json</a> · <a href=run_eval.py>run_eval.py</a> · <a href=probe.py>probe.py</a> · <a href=build_page.py>build_page.py</a></p></details>
<footer>NeuralLoot · numbers generated from results.json and probe_raw.json by build_page.py</footer>
</main></body></html>'''
assert "—" not in page
open("index.html","w").write(page)
