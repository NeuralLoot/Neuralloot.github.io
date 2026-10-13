# Hard GSM8K: test items ranked by number of reasoning steps (<<calc>> annotations) in the gold solution; top 200, then random.Random(20261013).sample 40.
import os,json,re,time,random,statistics,requests,concurrent.futures as cf
K=os.environ["OPENROUTER_API_KEY"];U="https://openrouter.ai/api/v1/chat/completions"
rows=[json.loads(l)|{"id":i} for i,l in enumerate(open("gsm8k_test.jsonl"))]
rows.sort(key=lambda r:(-r["answer"].count("<<"),r["id"]))
items=sorted(random.Random(20261013).sample(rows[:200],40),key=lambda r:r["id"])
json.dump([{"id":r["id"],"steps":r["answer"].count("<<"),"gold":r["answer"].split("####")[-1].strip().replace(",","")} for r in items],open("items.json","w"),indent=1)
ARMS={"argon_default":("google/gemini-4-argon",{}),
"argon_enable_thinking_false":("google/gemini-4-argon",{"enable_thinking":False}),
"argon_effort_minimal":("google/gemini-4-argon",{"reasoning":{"effort":"minimal"}}),
"flash_3.8_default":("google/gemini-3.8-flash",{})}
P="Solve the problem. End your reply with a final line of the form 'ANSWER: <number>'.\n\n"
def num(s):
  m=re.findall(r"ANSWER:\s*\$?\s*(-?[\d,]*\.?\d+)",s or "")
  if not m: m=re.findall(r"-?[\d,]*\.?\d+",s or "")
  return m[-1].replace(",","") if m else None
def eq(a,b):
  try: return abs(float(a)-float(b))<1e-6
  except: return False
spent=0.0
def call(arm,r):
  m,extra=ARMS[arm]
  b={"model":m,"messages":[{"role":"user","content":P+r["question"]}],"max_tokens":16000,"temperature":0,"seed":20261013,"usage":{"include":True},**extra}
  for a in range(3):
    t=time.time()
    try:
      x=requests.post(U,headers={"Authorization":"Bearer "+K},json=b,timeout=600);j=x.json();lat=time.time()-t
      if x.status_code==200 and j.get("choices"): break
    except Exception as e: j={"error":str(e)};lat=time.time()-t
    time.sleep(3)
  c=(j.get("choices") or [{}])[0].get("message",{}).get("content");u=j.get("usage",{})
  g=r["answer"].split("####")[-1].strip().replace(",","");p=num(c)
  return {"arm":arm,"model":m,"id":r["id"],"gold":g,"pred":p,"correct":eq(p,g),"latency_s":round(lat,2),"prompt_tokens":u.get("prompt_tokens"),"completion_tokens":u.get("completion_tokens"),"reasoning_tokens":(u.get("completion_tokens_details") or {}).get("reasoning_tokens"),"cost_usd":u.get("cost"),"provider":j.get("provider"),"error":j.get("error"),"content":c}
res=[]
with cf.ThreadPoolExecutor(12) as ex:
  for f in cf.as_completed([ex.submit(call,a,r) for a in ARMS for r in items]):
    x=f.result();res.append(x);spent+=x["cost_usd"] or 0
    if spent>5: raise SystemExit("spend cap")
res.sort(key=lambda x:(x["arm"],x["id"]))
with open("raw_outputs.jsonl","w") as f:
  for x in res: f.write(json.dumps(x)+"\n")
S={}
for a in ARMS:
  xs=[x for x in res if x["arm"]==a]
  S[a]={"model":ARMS[a][0],"params":ARMS[a][1],"n":len(xs),"correct":sum(x["correct"] for x in xs),"errors":sum(1 for x in xs if x["error"]),
  "median_latency_s":round(statistics.median(x["latency_s"] for x in xs),2),
  "mean_completion_tokens":round(statistics.mean(x["completion_tokens"] or 0 for x in xs)),
  "mean_reasoning_tokens":round(statistics.mean(x["reasoning_tokens"] or 0 for x in xs)),
  "total_cost_usd":round(sum(x["cost_usd"] or 0 for x in xs),4)}
json.dump({"date":"2026-10-13","suite":"GSM8K test, 40 items: random.Random(20261013).sample of the 200 items with most gold calc steps","item_ids":[r["id"] for r in items],"temperature":0,"summary":S,"total_cost_usd":round(spent,4)},open("results.json","w"),indent=1)
for a,s in S.items(): print(a,s)
print("total",spent)
