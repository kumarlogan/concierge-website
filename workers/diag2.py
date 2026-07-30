#!/usr/bin/env python3
import json, urllib.request, urllib.error, random, string
BASE="https://api.agsynergy.ca"
UA={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}
def req(method, path, body=None, headers=None):
    h=dict(UA)
    if headers: h.update(headers)
    data=json.dumps(body).encode() if body is not None else None
    if data is not None: h["Content-Type"]="application/json"
    r=urllib.request.Request(BASE+path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
rng="".join(random.choices(string.digits,k=10))
email=f"diag5-{rng}@agsynergy-test.ca"
# build a policy-compliant password programmatically (no literal typo risk)
pw = "G" + "o" + "l" + "d" + "3" + "n" + "P" + "a" + "t" + "h" + "#" + "9" + "X" + "y"  # 14 chars
assert len(pw) >= 12
s,b=req("POST","/identity/register",{"identityType":"patient","email":email,"password":pw,"profile":{"firstName":"D","lastName":"T"}})
reg=json.loads(b); iid=reg.get("identity",{}).get("id"); print("REG",s,"iid",iid)
s,b=req("POST","/identity/email/verify",{"identityId":iid,"email":email}); tok=json.loads(b).get("token")
s,b=req("POST","/identity/email/verify/complete",{"token":tok})
s,b=req("POST","/identity/login",{"email":email,"password":pw}); login=json.loads(b); at=login.get("accessToken") or login.get("token")
print("LOGIN keys:",list(login.keys()))
s,b=req("GET","/identity/me",headers={"Authorization":f"Bearer {at}"})
print("ME",s,b[:700])
