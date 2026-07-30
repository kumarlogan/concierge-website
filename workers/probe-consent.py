#!/usr/bin/env python3
import json, urllib.request, urllib.error, random, string, time
BASE="https://api.agsynergy.ca"
UA={"User-Agent":"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"}
def req(method, path, body=None, headers=None, raw=None):
    h=dict(UA)
    if headers: h.update(headers)
    data=None
    if raw is not None: data=raw; h["Content-Type"]="application/octet-stream"
    elif body is not None: data=json.dumps(body).encode(); h["Content-Type"]="application/json"
    r=urllib.request.Request(BASE+path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
rng="".join(random.choices(string.digits,k=10))
email=f"probe-{rng}@agsynergy-test.ca"
pw="G"+"o"+"l"+"d"+"3"+"n"+"P"+"a"+"t"+"h"+"#"+"9"+"X"+"y"
s,b=req("POST","/identity/register",{"identityType":"patient","email":email,"password":pw,"profile":{"firstName":"P","lastName":"T"}})
iid=json.loads(b).get("identity",{}).get("id"); print("REG",s,"iid",iid)
tok=json.loads(req("POST","/identity/email/verify",{"identityId":iid,"email":email})[1]).get("token")
req("POST","/identity/email/verify/complete",{"token":tok})
login=json.loads(req("POST","/identity/login",{"email":email,"password":pw})[1])
at=login.get("accessToken") or login.get("token")
AUTH={"Authorization":f"Bearer {at}"}
# grant appointment_scheduling
s,b=req("POST","/api/v1/consent/grant",{"identityId":iid,"consentType":"appointment_scheduling","scope":"healthcare","version":"1.0"},headers=AUTH)
print("GRANT",s,b[:200])
# immediate evaluate via trust endpoint
s,b=req("POST","/api/v1/trust/evaluate",{"identityId":iid},headers=AUTH)
print("TRUST_EVAL",s,b[:300])
# now book
future=time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime(time.time()+86400))
s,b=req("POST","/api/v1/appointments",{"patientId":iid,"providerId":"prov-001","type":"consultation","startAt":future,"durationMinutes":30,"timezone":"America/Vancouver","title":"Probe"},headers=AUTH)
print("BOOK",s,b[:300])
