import os,json,requests,time
K=os.environ["OPENROUTER_API_KEY"];U="https://openrouter.ai/api/v1/chat/completions"
M="google/gemini-4-argon"
cases={"effort_none":{"reasoning":{"effort":"none"}},
"enable_thinking_false":{"enable_thinking":False},
"reasoning_enabled_false":{"reasoning":{"enabled":False}},
"effort_minimal":{"reasoning":{"effort":"minimal"}},
"default":{}}
out={}
for n,extra in cases.items():
  b={"model":M,"messages":[{"role":"user","content":"What is 17*23? Answer with the number only."}],"max_tokens":2000,"usage":{"include":True},**extra}
  t=time.time();r=requests.post(U,headers={"Authorization":"Bearer "+K},json=b,timeout=180)
  j=r.json() if r.headers.get("content-type","").startswith("application/json") else {"text":r.text[:500]}
  u=j.get("usage",{});out[n]={"request_extra":extra,"http":r.status_code,"latency_s":round(time.time()-t,2),"usage":u,"error":j.get("error"),"content":(j.get("choices") or [{}])[0].get("message",{}).get("content")}
  print(n,r.status_code,u.get("completion_tokens"),(u.get("completion_tokens_details") or {}).get("reasoning_tokens"),u.get("cost"),str(j.get("error"))[:200])
json.dump(out,open("probe_raw.json","w"),indent=1)
