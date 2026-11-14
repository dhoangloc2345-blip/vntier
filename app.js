const $ = id => document.getElementById(id);
let players = [], tiers = [], modes = [];
const tierOrder = ["LT5","LT4","LT3","LT2","LT1","MT5","MT4","MT3","MT2","MT1","HT5","HT4","HT3","HT2","HT1"];
async function api(url, options={}) {
  const r = await fetch(url, {headers:{"Content-Type":"application/json"}, ...options});
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(data.error || "Có lỗi xảy ra");
  return data;
}
function render() {
  const mode = $("mode").value, query = $("search").value.toLowerCase();
  const list = players.filter(p=>p.name.toLowerCase().includes(query)).sort((a,b)=>(tierOrder.indexOf(a.tiers?.[mode]||"")<0?99:tierOrder.indexOf(a.tiers[mode]))-(tierOrder.indexOf(b.tiers?.[mode]||"")<0?99:tierOrder.indexOf(b.tiers[mode])));
  $("count").textContent = `${list.length} players`;
  $("rows").innerHTML = list.length ? list.map((p,i)=>`<tr><td>${i+1}</td><td><strong>${escapeHtml(p.name)}</strong></td><td class="tier ${tierClass(p.tiers?.[mode])}">${p.tiers?.[mode]||"—"}</td><td>${escapeHtml(p.discord||"—")}</td></tr>`).join("") : `<tr><td colspan="4">Chưa có người chơi phù hợp.</td></tr>`;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function tierClass(t){return t?.startsWith("LT")?"lt":t?.startsWith("MT")?"mt":t?.startsWith("HT")?"ht":"";}
async function refresh(){const d=await api("/api/public");players=d.players;tiers=d.tiers;modes=d.modes;render();}
$("search").addEventListener("input",render);$("mode").addEventListener("change",render);
$("loginOpen").onclick=()=>$("modal").classList.remove("hidden");
$("close").onclick=()=>$("modal").classList.add("hidden");
$("loginForm").onsubmit=async e=>{e.preventDefault();try{await api("/api/login",{method:"POST",body:JSON.stringify({password:$("password").value})});$("loginMsg").textContent="Đăng nhập thành công."; $("adminPanel").classList.remove("hidden");$("password").value="";}catch(err){$("loginMsg").textContent=err.message;}};
$("addForm").onsubmit=async e=>{e.preventDefault();try{const tiers={};tiers[$("playerMode").value]=$("playerTier").value;await api("/api/admin/players",{method:"POST",body:JSON.stringify({name:$("playerName").value,discord:$("discord").value,tiers})});$("playerName").value="";$("discord").value="";await refresh();$("loginMsg").textContent="Đã thêm người chơi."; }catch(err){$("loginMsg").textContent=err.message;}};
$("logout").onclick=async()=>{await api("/api/logout",{method:"POST"});$("adminPanel").classList.add("hidden");$("loginMsg").textContent="Đã đăng xuất.";};
refresh().catch(()=>{$("rows").innerHTML='<tr><td colspan="4">Không thể tải dữ liệu.</td></tr>';});