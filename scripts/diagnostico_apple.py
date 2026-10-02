# Pergunta à App Store Connect por que a versão não pode ir para revisão. Só lê e cria rascunho
# de envio (não envia nada para revisão).
import os, time, json, jwt, requests
k = os.environ["ASC_KEY_P8"]
tok = jwt.encode({"iss": os.environ["ASC_ISSUER_ID"], "iat": int(time.time()), "exp": int(time.time()) + 900,
                  "aud": "appstoreconnect-v1"}, k, algorithm="ES256", headers={"kid": os.environ["ASC_KEY_ID"]})
H = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
B = "https://api.appstoreconnect.apple.com/v1"
APP = "6749953259"
def get(p): r = requests.get(B + p, headers=H); return r.status_code, r.json()
s, v = get(f"/apps/{APP}/appStoreVersions?filter[platform]=IOS&limit=3&include=build")
for x in v.get("data", []): print("VERSAO", x["attributes"]["versionString"], x["attributes"]["appStoreState"], x["id"])
s, rs = get(f"/apps/{APP}/reviewSubmissions?limit=5")
for x in rs.get("data", []): print("ENVIO", x["id"], x["attributes"].get("state"))
ver = [x for x in v["data"] if x["attributes"]["versionString"] == os.environ.get("VERSAO", "4.34.6")][0]["id"]
aberto = [x["id"] for x in rs.get("data", []) if x["attributes"].get("state") == "READY_FOR_REVIEW"]
if aberto: sub = aberto[0]
else:
    r = requests.post(B + "/reviewSubmissions", headers=H, json={"data": {"type": "reviewSubmissions",
        "attributes": {"platform": "IOS"}, "relationships": {"app": {"data": {"type": "apps", "id": APP}}}}})
    print("CRIAR ENVIO", r.status_code, json.dumps(r.json())[:1500]); sub = r.json().get("data", {}).get("id")
r = requests.post(B + "/reviewSubmissionItems", headers=H, json={"data": {"type": "reviewSubmissionItems",
    "relationships": {"reviewSubmission": {"data": {"type": "reviewSubmissions", "id": sub}},
                      "appStoreVersion": {"data": {"type": "appStoreVersions", "id": ver}}}}})
print("ITEM", r.status_code); print(json.dumps(r.json(), indent=1, ensure_ascii=False)[:6000])
