#!/usr/bin/env python3
import json, urllib.request, urllib.error, random, string, time
BASE="https://api.agsynergy.ca"
UA={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}

def req(method, path, body=None, headers=None, raw=None):
    h=dict(UA)
    if headers: h.update(headers)
    data=None
    if raw is not None:
        data=raw; h["Content-Type"]="application/octet-stream"
    elif body is not None:
        data=json.dumps(body).encode(); h["Content-Type"]="application/json"
    r=urllib.request.Request(BASE+path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

rng="".join(random.choices(string.digits,k=10))
email=f"diag-{rng}@agsynergy-test.ca"
pw="Gold...Xy"
print("EMAIL", email)
s,b=req("POST","/identity/register",{"identityType":"patient","email":email,"password":pw,"profile":{"firstName":"Diag","lastName":"Test"}})
print("REGISTER", s, b[:400])
try:
    reg=json.loads(b); iid=reg.get("identity",{}).get("id")
except Exception: iid=None
print("identityId", iid)
s,b=req("POST","/identity/email/verify",{"identityId":iid,"email":email})
print("VERIFY", s, b[:300])
try: tok=json.loads(b).get("token")
except Exception: tok=None
s,b=req("POST","/identity/email/verify/complete",{"token":tok})
print("VERIFY-COMPLETE", s, b[:200])
s,b=req("POST","/identity/login",{"email":email,"password":pw})
print("LOGIN", s, b[:400])
try:
    login=json.loads(b); at=login.get("accessToken") or login.get("token")
except Exception: at=None
print("accessToken?", bool(at), "len", len(at) if at else 0)
s,b=req("GET","/identity/me",headers={"Authorization":f"Bearer {at}"})
print("ME", s, b[:800])
