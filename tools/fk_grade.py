"""Flesch-Kincaid grade of main-flow text. Usage: import fk(texts) or run on a txt file (one UI string per line)."""
import re,sys
def syl(w):
    w=w.lower(); w=re.sub(r'[^a-z]','',w)
    if not w: return 0
    if len(w)<=3: return 1
    w=re.sub(r'(?:[^laeiouy]es|ed|[^laeiouy]e)$','',w); w=re.sub(r'^y','',w)
    return max(1,len(re.findall(r'[aeiouy]{1,2}',w)))
TERMS=r"OOM|OOMs|shards?|GB|RAM|4-bit|8-bit|9B|26B|sub-30B|GLM-5\.2|GLM|link|uptime|cascade|Scan|Access|Payload|Inference|Spawn|enlist|swarm|sorry-free|sorry|have|cite|rw|Lean|tactics?|episodes?|Erd\w*|lemma|prover|Basic loop|Full agent|resample|held-out|trained-on|trend|compute|base model|reasoning|benchmarks?|index|Muse Spark 1\.3|Muse Wonder Full|Wonder Full|Opus 5\.5|Opus|Wonder|ProgramBench|SWE-Marathon|AA Index|Artificial Analysis|Meta|Anthropic|AlphaProof|Tsoukalas|hypothesis"
def strip_terms(t):
    return re.sub(r"\b(?:"+TERMS+r")\b","",t,flags=re.I)
def fk(texts, ignore_terms=True):
    if ignore_terms: texts=[strip_terms(t) for t in texts]
    W=S=Y=0
    for t in texts:
        t=re.sub(r'[^\w\s\.\!\?\'\-]',' ',t)
        for sent in re.split(r'[\.\!\?]+',t):
            ws=[w for w in re.findall(r"[A-Za-z][A-Za-z'\-]*",sent)]
            if not ws: continue
            S+=1; W+=len(ws); Y+=sum(syl(w) for w in ws)
    if not W: return 0,0,0
    return round(0.39*W/S+11.8*Y/W-15.59,1),W,S
if __name__=="__main__":
    print(fk([l for l in open(sys.argv[1]) if l.strip()]))
