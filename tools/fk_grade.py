"""Flesch-Kincaid grade of main-flow text. Usage: import fk(texts) or run on a txt file (one UI string per line)."""
import re,sys
def syl(w):
    w=w.lower(); w=re.sub(r'[^a-z]','',w)
    if not w: return 0
    if len(w)<=3: return 1
    w=re.sub(r'(?:[^laeiouy]es|ed|[^laeiouy]e)$','',w); w=re.sub(r'^y','',w)
    return max(1,len(re.findall(r'[aeiouy]{1,2}',w)))
def fk(texts):
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
