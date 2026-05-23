// ==================== CONSTANTS ====================
const CATS=[
  {id:'makanan',label:'Makanan & Minuman',color:'#F97316'},
  {id:'transportasi',label:'Transportasi',color:'#3B82F6'},
  {id:'tagihan',label:'Tagihan & Utilitas',color:'#8B5CF6'},
  {id:'hiburan',label:'Hiburan & Lifestyle',color:'#EC4899'},
  {id:'kesehatan',label:'Kesehatan',color:'#10B981'},
  {id:'belanja',label:'Belanja & Rumah',color:'#F59E0B'},
  {id:'pendidikan',label:'Pendidikan',color:'#6366F1'},
  {id:'sosial',label:'Sosial',color:'#14B8A6'},
  {id:'lainnya',label:'Lainnya',color:'#6B7280'},
];
const CURR=['IDR','USD','EUR','SGD','MYR'];
const INV_TYPES=['Saham','Reksa Dana','Kripto','Emas','Obligasi','Properti','Lainnya'];
const DEF_RATES={USD:16200,EUR:17800,SGD:12100,MYR:3600};
const ACC_TYPES=[
  {id:'cash',label:'Dompet/Kas',icon:'👛',color:'#F59E0B'},
  {id:'bank',label:'Rekening Bank',icon:'🏦',color:'#3B82F6'},
  {id:'ewallet',label:'E-Wallet',icon:'📱',color:'#10B981'},
  {id:'credit',label:'Kartu Kredit',icon:'💳',color:'#EF4444'},
  {id:'savings',label:'Tabungan/Deposito',icon:'🐷',color:'#8B5CF6'},
];

// URL Google Sheets — sudah terpasang
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwvaNsHCyQO_D_QMQz2csb6dTWwmLOL9ZGGRhmmlPXwxN-KpbQvwNJ9YhAX7LShlFM/exec';

// ==================== STATE ====================
let currentView='dashboard';
let editId=null;
let currentModalType=null;
let tmpForm={};
let tmpRates={};

// ==================== STORAGE ====================
function ls(k,def){try{const s=localStorage.getItem(k);return s?JSON.parse(s):def;}catch{return def;}}
function ss(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
function getTx(){return ls('dk_tx',[])}
function setTx(v){ss('dk_tx',v);render()}
function getBudgets(){return ls('dk_budgets',[])}
function setBudgets(v){ss('dk_budgets',v);render()}
function getSavings(){return ls('dk_savings',[])}
function setSavings(v){ss('dk_savings',v);render()}
function getDebts(){return ls('dk_debts',[])}
function setDebts(v){ss('dk_debts',v);render()}
function getInv(){return ls('dk_inv',[])}
function setInv(v){ss('dk_inv',v);render()}
function getRates(){return ls('dk_rates',DEF_RATES)}
function setRates(v){ss('dk_rates',v);render()}
function getMonth(){return ls('dk_month',curMonth())}
function setMonth(v){ss('dk_month',v);render()}
function getAccounts(){return ls('dk_accounts',[])}
function setAccounts(v){ss('dk_accounts',v);render()}
function getTransfers(){return ls('dk_transfers',[])}
function setTransfers(v){ss('dk_transfers',v);render()}
function getSyncEnabled(){return ls('dk_sync_enabled',true)}
function setSyncEnabled(v){ss('dk_sync_enabled',v)}
function getLastSync(){return ls('dk_last_sync','')}
function setLastSync(v){ss('dk_last_sync',v)}
function getSyncStatus(){return ls('dk_sync_status','none')}
function setSyncStatus(v){ss('dk_sync_status',v);updateSyncDot()}

// ==================== HELPERS ====================
function uid(){return Math.random().toString(36).substr(2,9)+Date.now().toString(36).slice(-4)}
function today(){return new Date().toISOString().split('T')[0]}
function curMonth(){const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function toIDR(a,c){const r=getRates();return c==='IDR'?+a:(+a)*(r[c]||1)}
function fmtIDR(n){
  if(n===undefined||n===null||isNaN(n))return'Rp 0';
  const a=Math.abs(n),s=n<0?'-':'';
  if(a>=1e9)return`${s}Rp ${(a/1e9).toFixed(1)}M`;
  if(a>=1e6)return`${s}Rp ${(a/1e6).toFixed(1)}jt`;
  if(a>=1e3)return`${s}Rp ${(a/1e3).toFixed(0)}rb`;
  return`${s}Rp ${Math.round(a).toLocaleString('id-ID')}`;
}
function fmtFull(n){
  if(n===undefined||n===null||isNaN(n))return'Rp 0';
  const s=n<0?'-':'';
  return`${s}Rp ${Math.abs(Math.round(n)).toLocaleString('id-ID')}`;
}
// Format lengkap dengan 2 desimal — untuk saldo akun
function fmtAcc(n){
  if(n===undefined||n===null||isNaN(n))return'Rp 0,00';
  const s=n<0?'-':'';
  return`${s}Rp ${Math.abs(n).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function polarToXY(cx,cy,r,angle){
  const rad=(angle*Math.PI)/180;
  return{x:+(cx+r*Math.cos(rad)).toFixed(2),y:+(cy+r*Math.sin(rad)).toFixed(2)};
}
function getAccName(id){const a=getAccounts().find(x=>x.id===id);return a?a.name:''}
function getAccIcon(id){const a=getAccounts().find(x=>x.id===id);const t=ACC_TYPES.find(x=>x.id===a?.type);return t?.icon||'💰'}

// ==================== ACCOUNT BALANCE ====================
function calcBalance(id){
  const acc=getAccounts().find(a=>a.id===id);
  if(!acc)return 0;
  const txs=getTx().filter(t=>t.accountId===id);
  const inc=txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amountIDR,0);
  const exp=txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amountIDR,0);
  const tIn=getTransfers().filter(t=>t.toId===id).reduce((s,t)=>s+toIDR(t.amount,t.currency||'IDR'),0);
  const tOut=getTransfers().filter(t=>t.fromId===id).reduce((s,t)=>s+toIDR(t.amount,t.currency||'IDR'),0);
  return (acc.initialBalance||0)+inc-exp+tIn-tOut;
}
function calcTotalBalance(){return getAccounts().reduce((s,a)=>s+calcBalance(a.id),0)}

// ==================== GOOGLE SHEETS SYNC ====================
function updateSyncDot(s){
  if(s)setSyncStatus(s);
  const el=document.getElementById('sync-dot');
  if(el)el.className='sync-dot s-'+getSyncStatus();
}

async function syncSheets(action,payload){
  if(!getSyncEnabled())return;
  try{
    updateSyncDot('pending');
    await fetch(SHEETS_URL,{
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({action,payload,ts:new Date().toISOString()})
    });
    updateSyncDot('ok');
    setLastSync(new Date().toLocaleString('id-ID'));
  }catch(e){
    updateSyncDot('error');
    console.error('Sync error:',e);
  }
}

// Tarik semua data dari Sheets → simpan ke localStorage → render
async function pullFromSheets(silent){
  if(!getSyncEnabled())return;
  if(!silent){
    updateSyncDot('pending');
  }
  try{
    const res=await fetch(SHEETS_URL+'?t='+Date.now());
    const data=await res.json();
    if(data.status!=='ok')throw new Error(data.message||'Error');

    // Simpan transaksi dari Sheets ke localStorage
    if(Array.isArray(data.transactions)&&data.transactions.length>0){
      // Gabung: data Sheets jadi acuan, tambahkan data lokal yang belum ada di Sheets
      const sheetsIds=new Set(data.transactions.map(t=>t.id));
      const localOnly=getTx().filter(t=>!sheetsIds.has(t.id));
      ss('dk_tx',[...data.transactions,...localOnly]);
    }
    if(Array.isArray(data.transfers)&&data.transfers.length>0){
      const sheetsIds=new Set(data.transfers.map(t=>t.id));
      const localOnly=getTransfers().filter(t=>!sheetsIds.has(t.id));
      ss('dk_transfers',[...data.transfers,...localOnly]);
    }

    updateSyncDot('ok');
    setLastSync(new Date().toLocaleString('id-ID'));
    render();
    if(!silent)showToast('✓ Data berhasil ditarik dari Google Sheets');
  }catch(e){
    updateSyncDot('error');
    console.error('Pull error:',e);
    if(!silent)showToast('✗ Gagal tarik data — cek koneksi');
  }
}

function showToast(msg){
  let el=document.getElementById('toast');
  if(!el){
    el=document.createElement('div');
    el.id='toast';
    el.style.cssText='position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:var(--text);color:var(--bg);padding:.5rem 1.25rem;border-radius:99px;font-size:13px;z-index:9999;transition:opacity .3s;white-space:nowrap';
    document.body.appendChild(el);
  }
  el.textContent=msg;
  el.style.opacity='1';
  clearTimeout(el._t);
  el._t=setTimeout(()=>{el.style.opacity='0'},3000);
}

// ==================== NAVIGATION ====================
function nav(v){
  currentView=v;
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const nb=document.getElementById('nb-'+v);
  if(nb)nb.classList.add('active');
  render();
}

// ==================== RENDER ====================
function render(){
  const views={dashboard:renderDashboard,transaksi:renderTransaksi,akun:renderAkun,anggaran:renderAnggaran,tabungan:renderTabungan,utang:renderUtang,investasi:renderInvestasi,laporan:renderLaporan};
  const fn=views[currentView];
  const el=document.getElementById('view-container');
  if(el&&fn)el.innerHTML=fn();
  updateSyncDot();
}

// ==================== COMPUTED ====================
function computed(){
  const fMonth=getMonth();
  const transactions=getTx();
  const budgets=getBudgets();
  const monthTx=transactions.filter(t=>t.date.startsWith(fMonth));
  const income=monthTx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amountIDR,0);
  const expense=monthTx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amountIDR,0);
  const byCat={};
  monthTx.filter(t=>t.type==='expense').forEach(t=>{byCat[t.category]=(byCat[t.category]||0)+t.amountIDR});
  const byCatArr=Object.entries(byCat).map(([id,v])=>{const cat=CATS.find(c=>c.id===id);return{id,name:cat?.label||id,value:v,color:cat?.color||'#888'}}).sort((a,b)=>b.value-a.value);
  const budStat=budgets.filter(b=>b.month===fMonth).map(b=>{
    const spent=monthTx.filter(t=>t.type==='expense'&&t.category===b.category).reduce((s,t)=>s+t.amountIDR,0);
    return{...b,spent,pct:b.limit>0?(spent/b.limit)*100:0,cat:CATS.find(c=>c.id===b.category)};
  });
  const investments=getInv();
  const savings=getSavings();
  const debts=getDebts();
  const totalAssets=investments.reduce((s,i)=>s+i.currentValue,0);
  const totalSaved=savings.reduce((s,sv)=>s+sv.current,0);
  const totalOwed=debts.filter(d=>d.type==='utang'&&!d.paid).reduce((s,d)=>s+d.amountIDR,0);
  const totalRec=debts.filter(d=>d.type==='piutang'&&!d.paid).reduce((s,d)=>s+d.amountIDR,0);
  const totalBal=calcTotalBalance();
  const netWorth=totalBal+totalAssets+totalSaved-totalOwed;
  const warnings=budStat.filter(b=>b.pct>=80);
  return{fMonth,transactions,monthTx,income,expense,byCatArr,budStat,investments,savings,debts,totalAssets,totalSaved,totalOwed,totalRec,netWorth,warnings,totalBal};
}

// ==================== DASHBOARD ====================
function renderDashboard(){
  const{fMonth,monthTx,income,expense,byCatArr,warnings,netWorth,totalBal}=computed();
  const accounts=getAccounts();
  const now=new Date();
  const last6=Array.from({length:6},(_,i)=>{
    const d=new Date(now.getFullYear(),now.getMonth()-5+i,1);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const txs=getTx().filter(t=>t.date.startsWith(key));
    const inc=txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amountIDR,0)/1e6;
    const exp=txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amountIDR,0)/1e6;
    return{name:d.toLocaleDateString('id-ID',{month:'short'}),inc:+inc.toFixed(1),exp:+exp.toFixed(1)};
  });
  const saldo=income-expense;
  const warnHtml=warnings.length>0?`<div class="warn-banner">⚠️ <span>Anggaran hampir habis: <strong>${warnings.map(b=>`${b.cat?.label||b.category} (${Math.round(b.pct)}%)`).join(', ')}</strong></span></div>`:'';
  const txRows=monthTx.slice(0,5).map(tx=>{
    const cat=CATS.find(c=>c.id===tx.category);
    const an=getAccName(tx.accountId);
    return`<div class="tx-row">
      <div style="width:34px;height:34px;border-radius:50%;background:${(cat?.color||'#888')}22;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;color:${cat?.color||'#888'}">${tx.type==='income'?'↑':'↓'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(tx.description)}</div>
        <div class="muted" style="font-size:11px">${tx.date}${cat?` · ${cat.label}`:''}${an?` · ${an}`:''}</div>
      </div>
      <div style="font-size:13px;font-weight:500;color:${tx.type==='income'?'var(--green)':'var(--red)'}">
        ${tx.type==='income'?'+':'-'}${fmtIDR(tx.amountIDR)}
      </div>
    </div>`;
  }).join('');
  const maxVal=Math.max(...last6.map(d=>Math.max(d.inc,d.exp)),0.1);
  const ch=158,pad=30,bw=17;
  const barsHtml=last6.map((d,i)=>{
    const x=pad+i*(bw*2+18);
    const ih=Math.round((d.inc/maxVal)*(ch-36));
    const eh=Math.round((d.exp/maxVal)*(ch-36));
    return`<rect x="${x}" y="${ch-18-ih}" width="${bw}" height="${ih||1}" fill="#1D9E75" rx="3"/>
    <rect x="${x+bw+2}" y="${ch-18-eh}" width="${bw}" height="${eh||1}" fill="#D85A30" rx="3"/>
    <text x="${x+bw+1}" y="${ch-3}" text-anchor="middle" font-size="10" fill="var(--text3)">${d.name}</text>`;
  }).join('');
  const yLabels=[0,0.5,1].map(p=>{
    const val=(maxVal*p);
    const y=ch-18-Math.round(p*(ch-36));
    return`<text x="${pad-4}" y="${y}" text-anchor="end" font-size="9" fill="var(--text3)">${val.toFixed(1)}</text>
    <line x1="${pad}" y1="${y}" x2="488" y2="${y}" stroke="var(--border)" stroke-width="0.5"/>`;
  }).join('');
  let donutHtml='<div class="empty">Belum ada pengeluaran</div>';
  if(byCatArr.length>0){
    const total=byCatArr.reduce((s,c)=>s+c.value,0);
    let cumAngle=-90;
    const slices=byCatArr.map(c=>{
      const angle=(c.value/total)*360,sa=cumAngle,ea=cumAngle+angle;cumAngle+=angle;
      const s=polarToXY(70,70,55,sa),e=polarToXY(70,70,55,ea);
      const si=polarToXY(70,70,33,sa),ei=polarToXY(70,70,33,ea);
      const lg=angle>180?1:0;
      return`<path d="M ${s.x} ${s.y} A 55 55 0 ${lg} 1 ${e.x} ${e.y} L ${ei.x} ${ei.y} A 33 33 0 ${lg} 0 ${si.x} ${si.y} Z" fill="${c.color}" opacity=".9"/>`;
    }).join('');
    const legend=byCatArr.slice(0,5).map(c=>`<span style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text2)"><span style="width:8px;height:8px;border-radius:2px;background:${c.color};display:inline-block;flex-shrink:0"></span>${c.name}</span>`).join('');
    donutHtml=`<svg width="140" height="140" style="display:block;margin:0 auto">${slices}</svg><div style="display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:4px">${legend}</div>`;
  }
  const accCards=accounts.length>0?accounts.map(a=>{
    const bal=calcBalance(a.id);
    const at=ACC_TYPES.find(t=>t.id===a.type);
    return`<div class="acc-card"><div class="acc-stripe" style="background:${a.color||at?.color||'#888'}"></div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:3px">${at?.icon||'💰'} ${esc(a.name)}</div>
    <div style="font-size:15px;font-weight:600;color:${bal<0?'var(--red)':'var(--text)'}">${fmtAcc(bal)}</div>
    <div style="font-size:10px;color:var(--text3);margin-top:2px">${at?.label||''}</div></div>`;
  }).join(''):`<div style="font-size:13px;color:var(--text3);padding:.5rem 0">Tambahkan akun di menu 💼 Akun</div>`;

  return`${warnHtml}
  <div class="row">
    <h2 class="h2">Ringkasan Keuangan</h2>
    <input type="month" class="inp" style="width:140px;font-size:13px" value="${fMonth}" onchange="setMonth(this.value)">
  </div>
  <div class="g4" style="margin-bottom:14px">
    <div class="metric"><div class="metric-label">Total Saldo</div><div class="metric-val" style="color:var(--blue)">${fmtAcc(totalBal)}</div></div>
    <div class="metric"><div class="metric-label">Pemasukan Bln Ini</div><div class="metric-val" style="color:var(--green)">${fmtIDR(income)}</div></div>
    <div class="metric"><div class="metric-label">Pengeluaran Bln Ini</div><div class="metric-val" style="color:var(--red)">${fmtIDR(expense)}</div></div>
    <div class="metric"><div class="metric-label">Net Worth</div><div class="metric-val" style="color:var(--blue)">${fmtIDR(netWorth)}</div></div>
  </div>
  <div class="card" style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="h3">Saldo per Akun</div>
      <div style="display:flex;gap:6px">
        <button class="btn-amber" onclick="openModal('transfer')">⇄ Transfer</button>
        <button class="btn" style="font-size:12px" onclick="nav('akun')">Kelola →</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">${accCards}</div>
  </div>
  <div class="g2">
    <div class="card">
      <div class="h3" style="margin-bottom:8px">6 Bulan Terakhir <span class="muted" style="font-size:11px">(juta Rp)</span></div>
      <div class="chart-wrap"><svg viewBox="0 0 490 162" width="100%" style="overflow:visible">${yLabels}${barsHtml}</svg></div>
      <div style="display:flex;gap:12px;margin-top:4px">
        <span style="font-size:11px;color:var(--text2);display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:#1D9E75;display:inline-block"></span>Masuk</span>
        <span style="font-size:11px;color:var(--text2);display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:#D85A30;display:inline-block"></span>Keluar</span>
      </div>
    </div>
    <div class="card"><div class="h3" style="margin-bottom:8px">Pengeluaran per Kategori</div>${donutHtml}</div>
  </div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="h3">Transaksi Terbaru</div>
      <button class="btn" style="font-size:12px" onclick="nav('transaksi')">Lihat semua →</button>
    </div>
    ${txRows||'<div class="empty">Belum ada transaksi bulan ini</div>'}
    <div style="margin-top:12px;text-align:center"><button class="btn-p" onclick="openModal('tx')">+ Tambah Transaksi</button></div>
  </div>`;
}

// ==================== AKUN ====================
function renderAkun(){
  const accounts=getAccounts();
  const transfers=getTransfers();
  const totalBal=calcTotalBalance();
  const cards=accounts.length===0?`<div class="card"><div class="empty">Belum ada akun. Tambahkan akunmu sekarang!</div></div>`:
    `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-bottom:12px">`+
    accounts.map(a=>{
      const bal=calcBalance(a.id);
      const at=ACC_TYPES.find(t=>t.id===a.type);
      return`<div class="acc-card">
        <div class="acc-stripe" style="background:${a.color||at?.color||'#888'}"></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
          <div>
            <div style="font-size:12px;color:var(--text2)">${at?.icon||'💰'} ${at?.label||''}</div>
            <div style="font-size:15px;font-weight:500;margin-top:2px">${esc(a.name)}</div>
          </div>
          <div style="display:flex;gap:2px">
            <button class="btn-icon" onclick="editAcc('${a.id}')">✏️</button>
            <button class="btn-icon" style="color:var(--red)" onclick="deleteAcc('${a.id}')">🗑️</button>
          </div>
        </div>
        <div style="font-size:20px;font-weight:600;color:${bal<0?'var(--red)':'var(--green)'}">${fmtAcc(bal)}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">Modal awal: ${fmtAcc(a.initialBalance||0)}</div>
      </div>`;
    }).join('')+`</div>`;
  const tRows=transfers.slice(0,15).map(t=>{
    const fa=getAccName(t.fromId),ta=getAccName(t.toId);
    return`<div class="transfer-row">
      <div style="width:32px;height:32px;border-radius:50%;background:var(--amber-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px">⇄</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500">${esc(fa)} → ${esc(ta)}</div>
        <div style="font-size:11px;color:var(--text2)">${t.date}${t.note?` · ${esc(t.note)}`:''}</div>
      </div>
      <div style="font-size:13px;font-weight:500;color:var(--amber);flex-shrink:0;margin-right:6px">${fmtIDR(toIDR(t.amount,t.currency||'IDR'))}</div>
      <button class="btn-icon" style="color:var(--red)" onclick="deleteTransfer('${t.id}')">🗑️</button>
    </div>`;
  }).join('');
  return`<div class="row">
    <h2 class="h2">Akun Keuangan</h2>
    <div style="display:flex;gap:6px">
      <button class="btn-amber" onclick="openModal('transfer')">⇄ Transfer Antar Akun</button>
      <button class="btn-p" onclick="openModal('account')">+ Tambah Akun</button>
    </div>
  </div>
  <div class="metric" style="margin-bottom:12px">
    <div class="metric-label">Total Saldo Semua Akun</div>
    <div class="metric-val" style="font-size:22px;color:${totalBal>=0?'var(--blue)':'var(--red)'}">${fmtAcc(totalBal)}</div>
  </div>
  ${cards}
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="h3">Riwayat Transfer</div>
      <button class="btn-amber" onclick="openModal('transfer')">+ Transfer Baru</button>
    </div>
    ${transfers.length===0?'<div class="empty">Belum ada transfer</div>':tRows}
  </div>`;
}

// ==================== TRANSAKSI ====================
function renderTransaksi(){
  const{fMonth}=computed();
  const search=ls('dk_search','');
  const filterType=ls('dk_ftype','all');
  const filterCat=ls('dk_fcat','all');
  const filterAcc=ls('dk_facc','all');
  const accounts=getAccounts();
  let filtered=getTx().filter(t=>t.date.startsWith(fMonth));
  if(search)filtered=filtered.filter(t=>t.description.toLowerCase().includes(search.toLowerCase())||(t.note||'').toLowerCase().includes(search.toLowerCase()));
  if(filterType!=='all')filtered=filtered.filter(t=>t.type===filterType);
  if(filterCat!=='all')filtered=filtered.filter(t=>t.category===filterCat);
  if(filterAcc!=='all')filtered=filtered.filter(t=>t.accountId===filterAcc);
  const rows=filtered.map((tx)=>{
    const cat=CATS.find(c=>c.id===tx.category);
    const an=getAccName(tx.accountId);
    return`<div class="tx-row">
      <div style="width:34px;height:34px;border-radius:50%;background:${(cat?.color||'#888')}22;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;color:${cat?.color||'#888'}">${tx.type==='income'?'↑':'↓'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:500">${esc(tx.description)}</div>
        <div class="muted" style="font-size:11px">${tx.date}${cat?` · ${cat.label}`:''}${an?` · ${an}`:''}</div>
        ${tx.note?`<div style="font-size:11px;color:var(--text3);font-style:italic">${esc(tx.note)}</div>`:''}
      </div>
      <div style="text-align:right;margin-right:6px;flex-shrink:0">
        <div style="font-size:13px;font-weight:500;color:${tx.type==='income'?'var(--green)':'var(--red)'}">${tx.type==='income'?'+':'-'}${fmtIDR(tx.amountIDR)}</div>
        ${tx.currency!=='IDR'?`<div style="font-size:10px;color:var(--text3)">${tx.amount} ${tx.currency}</div>`:''}
      </div>
      <button class="btn-icon" onclick="editTx('${tx.id}')">✏️</button>
      <button class="btn-icon" style="color:var(--red)" onclick="deleteTx('${tx.id}')">🗑️</button>
    </div>`;
  }).join('');
  const catOpts=CATS.map(c=>`<option value="${c.id}"${filterCat===c.id?' selected':''}>${c.label}</option>`).join('');
  const accOpts=accounts.map(a=>`<option value="${a.id}"${filterAcc===a.id?' selected':''}>${esc(a.name)}</option>`).join('');
  return`<div class="row">
    <h2 class="h2">Transaksi</h2>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn" onclick="exportCSV()">⬇️ Ekspor CSV</button>
      <button class="btn-p" onclick="openModal('tx')">+ Tambah</button>
    </div>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
    <input type="month" class="inp" style="width:140px;font-size:13px" value="${fMonth}" onchange="setMonth(this.value)">
    <input class="inp" style="flex:1;min-width:180px" placeholder="🔍 Cari deskripsi atau catatan..." value="${esc(search)}" oninput="ss('dk_search',this.value);render()">
    <select class="sel" style="width:auto" onchange="ss('dk_ftype',this.value);render()">
      <option value="all"${filterType==='all'?' selected':''}>Semua Tipe</option>
      <option value="income"${filterType==='income'?' selected':''}>Pemasukan</option>
      <option value="expense"${filterType==='expense'?' selected':''}>Pengeluaran</option>
    </select>
    <select class="sel" style="width:auto" onchange="ss('dk_fcat',this.value);render()">
      <option value="all"${filterCat==='all'?' selected':''}>Semua Kategori</option>${catOpts}
    </select>
    ${accounts.length>0?`<select class="sel" style="width:auto" onchange="ss('dk_facc',this.value);render()"><option value="all">Semua Akun</option>${accOpts}</select>`:''}
  </div>
  <div class="card">${filtered.length===0?'<div class="empty">Tidak ada transaksi ditemukan</div>':rows}</div>`;
}

// ==================== ANGGARAN ====================
function renderAnggaran(){
  const{fMonth,budStat}=computed();
  const budCatIds=budStat.map(b=>b.category);
  const unset=CATS.filter(c=>!budCatIds.includes(c.id));
  const cards=budStat.map(b=>`<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div>
        <div style="font-size:13px;font-weight:500;display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:2px;background:${b.cat?.color||'#888'};display:inline-block"></span>${b.cat?.label||b.category}</div>
        <div class="muted" style="font-size:11px;margin-top:2px">${fmtFull(b.spent)} / ${fmtFull(b.limit)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:4px">
        ${b.pct>=80?'<span style="font-size:13px">⚠️</span>':''}
        <span style="font-size:13px;font-weight:600;color:${b.pct>=100?'var(--red)':b.pct>=80?'var(--amber)':'var(--text)'}">${Math.round(b.pct)}%</span>
        <button class="btn-icon" style="font-size:12px" onclick="deleteBudget('${b.id}')">✕</button>
      </div>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(b.pct,100)}%;background:${b.pct>=100?'#E24B4A':b.pct>=80?'#EF9F27':(b.cat?.color||'#1D9E75')}"></div></div>
    <div style="font-size:11px;color:var(--text2);margin-top:4px">Sisa: ${fmtFull(Math.max(0,b.limit-b.spent))}</div>
  </div>`).join('');
  const unsetBtns=unset.map(c=>`<button class="btn" style="font-size:12px" onclick="openBudget('${c.id}')"><span style="width:6px;height:6px;border-radius:2px;background:${c.color};display:inline-block"></span>${c.label} +</button>`).join('');
  return`<div class="row">
    <h2 class="h2">Anggaran</h2>
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <input type="month" class="inp" style="width:140px;font-size:13px" value="${fMonth}" onchange="setMonth(this.value)">
      <button class="btn-p" onclick="openBudget('')">+ Set Anggaran</button>
    </div>
  </div>
  ${budStat.length===0?`<div class="card"><div class="empty">Belum ada anggaran untuk bulan ini</div></div>`:`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-bottom:12px">${cards}</div>`}
  ${unset.length>0?`<div class="card"><div style="font-size:13px;color:var(--text2);margin-bottom:8px">Belum diset anggaran:</div><div style="display:flex;flex-wrap:wrap;gap:6px">${unsetBtns}</div></div>`:''}`;
}

// ==================== TABUNGAN ====================
function renderTabungan(){
  const savings=getSavings();
  const totalSaved=savings.reduce((s,sv)=>{
    const cur=sv.accountId?Math.max(0,calcBalance(sv.accountId)):sv.current;
    return s+cur;
  },0);
  const totalTarget=savings.reduce((s,sv)=>s+sv.target,0);
  const cards=savings.map(sv=>{
    // Kalau linked ke akun, ambil saldo akun. Kalau tidak, pakai manual
    const current=sv.accountId?Math.max(0,calcBalance(sv.accountId)):sv.current;
    const pct=sv.target>0?Math.min((current/sv.target)*100,100):0;
    const done=current>=sv.target&&sv.target>0;
    const remaining=Math.max(0,sv.target-current);
    const linkedAcc=sv.accountId?getAccounts().find(a=>a.id===sv.accountId):null;
    const linkedBadge=linkedAcc?`<span style="font-size:10px;background:var(--blue-bg);color:var(--blue);padding:1px 7px;border-radius:99px;margin-left:5px">🔗 ${esc(linkedAcc.name)}</span>`:'';
    let deadline='';
    if(sv.deadline){
      const d=new Date(sv.deadline),now=new Date();
      const days=Math.ceil((d-now)/(1000*60*60*24));
      if(!isNaN(days)){deadline=`<div style="font-size:11px;color:${days<0?'var(--red)':days<30?'var(--amber)':'var(--text2)'}">📅 Deadline: ${sv.deadline}${days>=0?` (${days} hari lagi)`:' (lewat)'}</div>`;}
      else{deadline=`<div style="font-size:11px;color:var(--text2)">📅 Deadline: ${sv.deadline}</div>`;}
    }
    return`<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <div style="font-size:14px;font-weight:500;display:flex;align-items:center;flex-wrap:wrap;gap:4px">
            ${done?'<span style="color:var(--green)">✓</span>':''}${esc(sv.name)}${linkedBadge}
          </div>
          ${deadline}
        </div>
        <div style="display:flex;gap:2px">
          <button class="btn-icon" onclick="editSaving('${sv.id}')">✏️</button>
          <button class="btn-icon" style="color:var(--red)" onclick="deleteSaving('${sv.id}')">🗑️</button>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
        <span style="color:var(--text2)">${fmtAcc(current)}</span>
        <span style="font-weight:500">${fmtAcc(sv.target)}</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${done?'var(--green)':'var(--blue)'}"></div></div>
      <div style="font-size:11px;color:var(--text2);margin-top:4px">
        ${Math.round(pct)}% terkumpul · Kurang ${fmtAcc(remaining)}
        ${linkedAcc?`<span style="color:var(--blue)"> · otomatis dari saldo akun</span>`:''}
      </div>
    </div>`;
  }).join('');
  return`<div class="row"><h2 class="h2">Target Tabungan</h2><button class="btn-p" onclick="openModal('saving')">+ Tambah Target</button></div>
  ${savings.length>0?`<div class="g3" style="margin-bottom:14px"><div class="metric"><div class="metric-label">Total Terkumpul</div><div class="metric-val" style="color:var(--green)">${fmtIDR(totalSaved)}</div></div><div class="metric"><div class="metric-label">Total Target</div><div class="metric-val">${fmtIDR(totalTarget)}</div></div><div class="metric"><div class="metric-label">Progress</div><div class="metric-val" style="color:var(--blue)">${totalTarget>0?Math.round((totalSaved/totalTarget)*100):0}%</div></div></div>`:''}
  ${savings.length===0?`<div class="card"><div class="empty">Belum ada target tabungan</div></div>`:`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px">${cards}</div>`}`;
}

// ==================== UTANG & PIUTANG ====================
function renderUtang(){
  const{totalOwed,totalRec}=computed();
  const debts=getDebts();
  const aktifU=debts.filter(d=>d.type==='utang'&&!d.paid);
  const aktifP=debts.filter(d=>d.type==='piutang'&&!d.paid);
  const lunas=debts.filter(d=>d.paid);
  function debtRows(items,debtType){
    if(items.length===0)return'<div style="padding:0.5rem 0;color:var(--text3);font-size:13px">Tidak ada data</div>';
    const isU=debtType==='utang';
    const cv=isU?'var(--red)':'var(--green)',bg=isU?'var(--red-bg)':'var(--green-bg)';
    return items.map(d=>{
      let dueInfo='';
      if(d.dueDate){
        const dd=new Date(d.dueDate),now=new Date();
        const days=Math.ceil((dd-now)/(1000*60*60*24));
        dueInfo=` · <span style="color:${days<0?'var(--red)':days<7?'var(--amber)':'var(--text2)'}">JT: ${d.dueDate}${days<0?' (lewat)':days===0?' (hari ini)':''}</span>`;
      }
      return`<div class="tx-row"><div style="width:32px;height:32px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;color:${cv}">👤</div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500">${esc(d.person)}</div><div style="font-size:11px;color:var(--text2)">${d.date}${dueInfo}</div>${d.note?`<div style="font-size:11px;color:var(--text3);font-style:italic">${esc(d.note)}</div>`:''}</div><div style="text-align:right;margin-right:6px;flex-shrink:0"><div style="font-size:13px;font-weight:500;color:${cv}">${fmtIDR(d.amountIDR)}</div>${d.currency!=='IDR'?`<div style="font-size:10px;color:var(--text3)">${d.amount} ${d.currency}</div>`:''}</div><button class="btn" style="font-size:11px;padding:0.3rem 0.6rem;color:var(--green);border-color:var(--green)" onclick="markDebtPaid('${d.id}')">✓ Lunas</button><button class="btn-icon" style="color:var(--red)" onclick="deleteDebt('${d.id}')">🗑️</button></div>`;
    }).join('');
  }
  const lunasRows=lunas.map(d=>`<div class="tx-row" style="opacity:.5"><span style="color:var(--green);font-size:14px">✓</span><div style="flex:1;font-size:12px"><span style="text-decoration:line-through">${esc(d.person)}</span><span class="badge" style="background:${d.type==='utang'?'var(--red-bg)':'var(--green-bg)'};color:${d.type==='utang'?'var(--red)':'var(--green)'};margin-left:6px">${d.type}</span></div><span style="font-size:12px;color:var(--text2);margin-right:6px">${fmtIDR(d.amountIDR)}</span><button class="btn-icon" style="color:var(--red)" onclick="deleteDebt('${d.id}')">🗑️</button></div>`).join('');
  return`<div class="row"><h2 class="h2">Utang & Piutang</h2><div style="display:flex;gap:6px"><button class="btn" style="color:var(--red);border-color:var(--red-bg)" onclick="openDebt('utang')">+ Catat Utang</button><button class="btn-p" onclick="openDebt('piutang')">+ Catat Piutang</button></div></div>
  <div class="g2"><div class="metric" style="border-left:3px solid var(--red2)"><div class="metric-label">Total Utang</div><div class="metric-val" style="color:var(--red)">${fmtIDR(totalOwed)}</div></div><div class="metric" style="border-left:3px solid var(--green2)"><div class="metric-label">Total Piutang</div><div class="metric-val" style="color:var(--green)">${fmtIDR(totalRec)}</div></div></div>
  <div class="card"><div class="h3" style="color:var(--red);margin-bottom:6px">Utang belum lunas (${aktifU.length})</div>${debtRows(aktifU,'utang')}</div>
  <div class="card"><div class="h3" style="color:var(--green);margin-bottom:6px">Piutang belum lunas (${aktifP.length})</div>${debtRows(aktifP,'piutang')}</div>
  ${lunas.length>0?`<div class="card"><div class="h3" style="color:var(--text2);margin-bottom:6px">Sudah lunas (${lunas.length})</div>${lunasRows}</div>`:''}`;
}

// ==================== INVESTASI ====================
function renderInvestasi(){
  const investments=getInv();
  const totalBuy=investments.reduce((s,i)=>s+i.buyAmount,0);
  const totalCur=investments.reduce((s,i)=>s+i.currentValue,0);
  const gain=totalCur-totalBuy;
  const gainP=totalBuy>0?((gain/totalBuy)*100).toFixed(1):'0.0';
  const rows=investments.map(inv=>{
    const g=inv.currentValue-inv.buyAmount;
    const gP=inv.buyAmount>0?((g/inv.buyAmount)*100).toFixed(1):'0.0';
    return`<div class="tx-row"><div style="width:38px;height:38px;border-radius:var(--radius);background:var(--bg3);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;color:var(--text2);font-weight:600">${inv.type.slice(0,2).toUpperCase()}</div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500">${esc(inv.name)}</div><div style="font-size:11px;color:var(--text2)">${inv.type} · ${inv.date}</div>${inv.note?`<div style="font-size:11px;color:var(--text3);font-style:italic">${esc(inv.note)}</div>`:''}</div><div style="text-align:right;margin-right:6px;flex-shrink:0"><div style="font-size:13px;font-weight:500">${fmtIDR(inv.currentValue)}</div><div style="font-size:11px;color:${g>=0?'var(--green)':'var(--red)'}">${g>=0?'+':''}${gP}% (${fmtIDR(g)})</div></div><button class="btn-icon" onclick="editInv('${inv.id}')">✏️</button><button class="btn-icon" style="color:var(--red)" onclick="deleteInv('${inv.id}')">🗑️</button></div>`;
  }).join('');
  return`<div class="row"><h2 class="h2">Investasi & Aset</h2><button class="btn-p" onclick="openModal('inv')">+ Tambah</button></div>
  <div class="g3" style="margin-bottom:14px"><div class="metric"><div class="metric-label">Nilai Sekarang</div><div class="metric-val">${fmtIDR(totalCur)}</div></div><div class="metric"><div class="metric-label">Total Modal</div><div class="metric-val">${fmtIDR(totalBuy)}</div></div><div class="metric" style="border-left:3px solid ${gain>=0?'var(--green2)':'var(--red2)'}"><div class="metric-label">Untung / Rugi</div><div class="metric-val" style="color:${gain>=0?'var(--green)':'var(--red)'}">${gain>=0?'+':''}${fmtIDR(gain)} <span style="font-size:12px">(${gain>=0?'+':''}${gainP}%)</span></div></div></div>
  <div class="card">${investments.length===0?'<div class="empty">Belum ada investasi yang dicatat</div>':rows}</div>`;
}

// ==================== LAPORAN ====================
function renderLaporan(){
  const{fMonth,income,expense,byCatArr}=computed();
  const year=fMonth.split('-')[0];
  const allTx=getTx();
  const monthly=Array.from({length:12},(_,i)=>{
    const key=`${year}-${String(i+1).padStart(2,'0')}`;
    const txs=allTx.filter(t=>t.date.startsWith(key));
    const inc=txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amountIDR,0);
    const exp=txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amountIDR,0);
    return{name:new Date(+year,i,1).toLocaleDateString('id-ID',{month:'long'}),inc,exp,saldo:inc-exp};
  });
  const annInc=monthly.reduce((s,m)=>s+m.inc,0);
  const annExp=monthly.reduce((s,m)=>s+m.exp,0);
  const annSaldo=annInc-annExp;
  const savingRate=annInc>0?((annSaldo/annInc)*100).toFixed(1):'0.0';
  const tableRows=monthly.map((m)=>`<tr style="opacity:${(m.inc===0&&m.exp===0)?0.3:1};border-bottom:1px solid var(--border)"><td style="padding:0.4rem 0.5rem;font-size:13px">${m.name}</td><td style="padding:0.4rem 0.5rem;text-align:right;font-size:13px;color:var(--green)">${fmtIDR(m.inc)}</td><td style="padding:0.4rem 0.5rem;text-align:right;font-size:13px;color:var(--red)">${fmtIDR(m.exp)}</td><td style="padding:0.4rem 0.5rem;text-align:right;font-size:13px;font-weight:500;color:${m.saldo>=0?'var(--green)':'var(--red)'}">${fmtIDR(m.saldo)}</td></tr>`).join('');
  const catRows=byCatArr.map(c=>`<div style="display:flex;align-items:center;gap:8px;padding:0.35rem 0;border-bottom:1px solid var(--border)"><span style="width:8px;height:8px;border-radius:2px;background:${c.color};flex-shrink:0;display:block"></span><span style="flex:1;font-size:13px">${c.name}</span><span style="font-size:12px;color:var(--text2);min-width:40px;text-align:right">${expense>0?((c.value/expense)*100).toFixed(1):'0'}%</span><span style="font-size:13px;font-weight:500;min-width:100px;text-align:right">${fmtFull(c.value)}</span></div>`).join('');
  return`<div class="row"><h2 class="h2">Laporan ${year}</h2><div style="display:flex;gap:6px"><input type="month" class="inp" style="width:140px;font-size:13px" value="${fMonth}" onchange="setMonth(this.value)"><button class="btn" onclick="exportCSV()">⬇️ Ekspor CSV</button></div></div>
  <div class="g4"><div class="metric"><div class="metric-label">Pemasukan ${year}</div><div class="metric-val" style="color:var(--green);font-size:14px">${fmtIDR(annInc)}</div></div><div class="metric"><div class="metric-label">Pengeluaran ${year}</div><div class="metric-val" style="color:var(--red);font-size:14px">${fmtIDR(annExp)}</div></div><div class="metric"><div class="metric-label">Tabungan ${year}</div><div class="metric-val" style="color:${annSaldo>=0?'var(--green)':'var(--red)'};font-size:14px">${fmtIDR(annSaldo)}</div></div><div class="metric"><div class="metric-label">Saving Rate</div><div class="metric-val" style="color:var(--blue);font-size:14px">${savingRate}%</div></div></div>
  <div class="card"><div class="h3" style="margin-bottom:8px">Detail Bulan: ${fMonth}</div><div class="g3"><div class="metric"><div class="metric-label">Pemasukan</div><div class="metric-val" style="color:var(--green);font-size:15px">${fmtFull(income)}</div></div><div class="metric"><div class="metric-label">Pengeluaran</div><div class="metric-val" style="color:var(--red);font-size:15px">${fmtFull(expense)}</div></div><div class="metric"><div class="metric-label">Saldo</div><div class="metric-val" style="color:${income-expense>=0?'var(--green)':'var(--red)'};font-size:15px">${fmtFull(income-expense)}</div></div></div>${byCatArr.length>0?`<div style="font-size:13px;color:var(--text2);margin:10px 0 6px">Pengeluaran per kategori:</div>${catRows}`:''}</div>
  <div class="card"><div class="h3" style="margin-bottom:10px">Rekap Bulanan ${year}</div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:380px"><thead><tr style="border-bottom:1px solid var(--border)">${['Bulan','Pemasukan','Pengeluaran','Saldo'].map((h,i)=>`<th style="text-align:${i===0?'left':'right'};padding:0.4rem 0.5rem;font-weight:400;font-size:12px;color:var(--text2)">${h}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody><tfoot><tr style="border-top:2px solid var(--border2)"><td style="padding:0.5rem;font-size:13px;font-weight:600">Total</td><td style="padding:0.5rem;text-align:right;font-size:13px;font-weight:600;color:var(--green)">${fmtIDR(annInc)}</td><td style="padding:0.5rem;text-align:right;font-size:13px;font-weight:600;color:var(--red)">${fmtIDR(annExp)}</td><td style="padding:0.5rem;text-align:right;font-size:13px;font-weight:600;color:${annSaldo>=0?'var(--green)':'var(--red)'}">${fmtIDR(annSaldo)}</td></tr></tfoot></table></div></div>`;
}

// ==================== MODALS ====================
function openModal(type,data){
  currentModalType=type;
  editId=data?.id||null;
  if(type==='rates')tmpRates={};
  tmpForm=data?{...data,amount:String(data.amount||''),buyAmount:String(data.buyAmount||''),currentValue:String(data.currentValue||''),target:String(data.target||''),current:String(data.current||'')}:{
    type:type==='tx'?'expense':undefined,
    currency:'IDR',category:'makanan',date:today(),
  };
  renderModal();
  document.getElementById('overlay').style.display='flex';
}
function openBudget(catId){openModal('budget',{category:catId||CATS[0].id})}
function openDebt(type,data){openModal('debt',{...(data||{}),type})}
function editTx(id){const tx=getTx().find(t=>t.id===id);if(tx)openModal('tx',tx)}
function editSaving(id){const s=getSavings().find(x=>x.id===id);if(s)openModal('saving',s)}
function editInv(id){const inv=getInv().find(x=>x.id===id);if(inv)openModal('inv',inv)}
function editAcc(id){const acc=getAccounts().find(x=>x.id===id);if(acc){currentModalType='account';editId=id;tmpForm={...acc,initialBalance:String(acc.initialBalance||0),accType:acc.type};renderModal();document.getElementById('overlay').style.display='flex';}}
function closeModal(){document.getElementById('overlay').style.display='none';tmpForm={};editId=null;tmpRates={};}
function sf(k,v){
  tmpForm[k]=v;
  // Hanya re-render kalau perlu ubah tampilan modal
  // (toggle tipe, pilih currency buat conversion hint, pilih akun)
  if(k==='type'||k==='currency'||k==='accType'||k==='accountId'){
    renderModal();
  }
}
function sfr(k,v){tmpRates[k]=v;}

function renderModal(){
  const accounts=getAccounts();
  const rates=getRates();
  const titles={tx:editId?'Edit Transaksi':'Tambah Transaksi',budget:'Set Anggaran',saving:editId?'Edit Target':'Target Tabungan Baru',debt:`Catat ${tmpForm.type==='utang'?'Utang':'Piutang'}`,inv:editId?'Edit Investasi':'Tambah Investasi',rates:'Atur Kurs Mata Uang',account:editId?'Edit Akun':'Tambah Akun',transfer:'Transfer Antar Akun',settings:'Status Sinkronisasi'};
  const catOpts=CATS.map(c=>`<option value="${c.id}"${(tmpForm.category||'makanan')===c.id?' selected':''}>${c.label}</option>`).join('');
  const currOpts=CURR.map(c=>`<option value="${c}"${(tmpForm.currency||'IDR')===c?' selected':''}>${c}</option>`).join('');
  const accOpts=accounts.map(a=>`<option value="${a.id}"${tmpForm.accountId===a.id?' selected':''}>${esc(a.name)}</option>`).join('');
  const accOptsTf1=accounts.map(a=>`<option value="${a.id}"${tmpForm.fromId===a.id?' selected':''}>${esc(a.name)}</option>`).join('');
  const accOptsTf2=accounts.map(a=>`<option value="${a.id}"${tmpForm.toId===a.id?' selected':''}>${esc(a.name)}</option>`).join('');
  const accTypeOpts=ACC_TYPES.map(t=>`<option value="${t.id}"${(tmpForm.accType||'cash')===t.id?' selected':''}>${t.icon} ${t.label}</option>`).join('');
  const invTypeOpts=INV_TYPES.map(t=>`<option value="${t}"${(tmpForm.type||'Saham')===t?' selected':''}>${t}</option>`).join('');
  let body='';
  if(currentModalType==='tx'){
    const isInc=(tmpForm.type||'expense')==='income';
    const convHint=tmpForm.amount&&tmpForm.currency!=='IDR'?`<div style="font-size:11px;color:var(--text2);margin-top:3px">≈ ${fmtFull(toIDR(tmpForm.amount,tmpForm.currency))}</div>`:'';
    const accRow=accounts.length>0?`<div class="fg"><label>Akun</label><select class="sel" onchange="sf('accountId',this.value)"><option value="">-- Pilih Akun (opsional) --</option>${accOpts}</select></div>`:'';
    body=`<div class="fg"><label>Tipe</label><div style="display:flex;gap:6px"><button type="button" onclick="sf('type','income')" style="flex:1;padding:0.4rem;border-radius:var(--radius);border:1px solid ${isInc?'var(--green2)':'var(--border2)'};background:${isInc?'var(--green-bg)':'transparent'};color:${isInc?'var(--green)':'var(--text2)'};cursor:pointer;font-size:13px">↑ Pemasukan</button><button type="button" onclick="sf('type','expense')" style="flex:1;padding:0.4rem;border-radius:var(--radius);border:1px solid ${!isInc?'var(--red2)':'var(--border2)'};background:${!isInc?'var(--red-bg)':'transparent'};color:${!isInc?'var(--red)':'var(--text2)'};cursor:pointer;font-size:13px">↓ Pengeluaran</button></div></div>
    ${accRow}
    <div class="fg"><label>Nominal & Mata Uang</label><div style="display:grid;grid-template-columns:2fr 1fr;gap:6px"><input class="inp" type="number" placeholder="0" value="${tmpForm.amount||''}" oninput="sf('amount',this.value)"><select class="sel" onchange="sf('currency',this.value)">${currOpts}</select></div>${convHint}</div>
    ${!isInc?`<div class="fg"><label>Kategori</label><select class="sel" onchange="sf('category',this.value)">${catOpts}</select></div>`:''}
    <div class="fg"><label>Deskripsi</label><input class="inp" placeholder="Nama transaksi..." value="${esc(tmpForm.description||'')}" oninput="sf('description',this.value)"></div>
    <div class="fg"><label>Tanggal</label><input class="inp" type="date" value="${tmpForm.date||today()}" oninput="sf('date',this.value)"></div>
    <div class="fg"><label>Catatan (opsional)</label><input class="inp" placeholder="Catatan tambahan..." value="${esc(tmpForm.note||'')}" oninput="sf('note',this.value)"></div>`;
  }else if(currentModalType==='account'){
    body=`<div class="fg"><label>Nama Akun</label><input class="inp" placeholder="BCA, Gopay, Dompet, dll..." value="${esc(tmpForm.name||'')}" oninput="sf('name',this.value)"></div>
    <div class="fg"><label>Jenis Akun</label><select class="sel" onchange="sf('accType',this.value)">${accTypeOpts}</select></div>
    <div class="fg"><label>Saldo Awal (IDR)</label><input class="inp" type="number" placeholder="0" value="${tmpForm.initialBalance||''}" oninput="sf('initialBalance',this.value)"></div>
    <div class="fg"><label>Warna</label><input class="inp" type="color" value="${tmpForm.color||'#3B82F6'}" style="height:38px;padding:.25rem" onchange="sf('color',this.value)"></div>`;
  }else if(currentModalType==='transfer'){
    const convHint=tmpForm.amount&&tmpForm.currency!=='IDR'?`<div style="font-size:11px;color:var(--text2);margin-top:3px">≈ ${fmtFull(toIDR(tmpForm.amount,tmpForm.currency))}</div>`:'';
    body=`${accounts.length<2?`<div class="info-banner" style="margin-bottom:12px">ℹ️ Tambahkan minimal 2 akun dulu untuk transfer</div>`:''}
    <div class="fg"><label>Dari Akun</label><select class="sel" onchange="sf('fromId',this.value)"><option value="">-- Pilih --</option>${accOptsTf1}</select></div>
    <div style="text-align:center;font-size:18px;margin-bottom:.7rem;color:var(--amber)">⇣</div>
    <div class="fg"><label>Ke Akun</label><select class="sel" onchange="sf('toId',this.value)"><option value="">-- Pilih --</option>${accOptsTf2}</select></div>
    <div class="fg"><label>Nominal & Mata Uang</label><div style="display:grid;grid-template-columns:2fr 1fr;gap:6px"><input class="inp" type="number" placeholder="0" value="${tmpForm.amount||''}" oninput="sf('amount',this.value)"><select class="sel" onchange="sf('currency',this.value)">${currOpts}</select></div>${convHint}</div>
    <div class="fg"><label>Tanggal</label><input class="inp" type="date" value="${tmpForm.date||today()}" oninput="sf('date',this.value)"></div>
    <div class="fg"><label>Catatan (opsional)</label><input class="inp" placeholder="Keterangan transfer..." value="${esc(tmpForm.note||'')}" oninput="sf('note',this.value)"></div>`;
  }else if(currentModalType==='budget'){
    body=`<div class="fg"><label>Kategori</label><select class="sel" onchange="sf('category',this.value)">${catOpts}</select></div>
    <div class="fg"><label>Batas Anggaran (IDR)</label><input class="inp" type="number" placeholder="0" value="${tmpForm.limit||''}" oninput="sf('limit',this.value)"></div>`;
  }else if(currentModalType==='saving'){
    const accounts=getAccounts();
    const accOpts=accounts.map(a=>`<option value="${a.id}"${tmpForm.accountId===a.id?' selected':''}>${esc(a.name)}</option>`).join('');
    const isLinked=!!tmpForm.accountId;
    const linkedBal=isLinked?calcBalance(tmpForm.accountId):0;
    body=`<div class="fg"><label>Nama Target</label><input class="inp" placeholder="Dana Darurat, Liburan, Gadget baru..." value="${esc(tmpForm.name||'')}" oninput="sf('name',this.value)"></div>
    <div class="fg"><label>Target (IDR)</label><input class="inp" type="number" placeholder="0" value="${tmpForm.target||''}" oninput="sf('target',this.value)"></div>
    <div class="fg"><label>Link ke Akun <span style="font-size:11px;color:var(--text2)">(opsional — saldo akun jadi patokan terkumpul)</span></label>
      <select class="sel" onchange="sf('accountId',this.value)">
        <option value="">-- Manual / Tidak di-link --</option>${accOpts}
      </select>
    </div>
    ${isLinked
      ? `<div style="background:var(--blue-bg);border-radius:var(--radius);padding:.6rem .875rem;font-size:13px;color:var(--blue);margin-bottom:.7rem">🔗 Saldo akun saat ini: <strong>${fmtAcc(linkedBal)}</strong> — akan otomatis terupdate</div>`
      : `<div class="fg"><label>Sudah Terkumpul (IDR)</label><input class="inp" type="number" placeholder="0" value="${tmpForm.current||'0'}" oninput="sf('current',this.value)"></div>`
    }
    <div class="fg"><label>Deadline (opsional)</label><input class="inp" type="date" value="${tmpForm.deadline||''}" oninput="sf('deadline',this.value)"></div>`;
  }else if(currentModalType==='debt'){
    const isU=tmpForm.type==='utang';
    body=`<div class="fg"><label>${isU?'Nama Kreditur (yang memberi utang)':'Nama Debitur (yang berutang ke kamu)'}</label><input class="inp" placeholder="Nama orang atau lembaga..." value="${esc(tmpForm.person||'')}" oninput="sf('person',this.value)"></div>
    <div class="fg"><label>Nominal & Mata Uang</label><div style="display:grid;grid-template-columns:2fr 1fr;gap:6px"><input class="inp" type="number" placeholder="0" value="${tmpForm.amount||''}" oninput="sf('amount',this.value)"><select class="sel" onchange="sf('currency',this.value)">${currOpts}</select></div></div>
    <div class="fg"><label>Jatuh Tempo (opsional)</label><input class="inp" type="date" value="${tmpForm.dueDate||''}" oninput="sf('dueDate',this.value)"></div>
    <div class="fg"><label>Keterangan</label><input class="inp" placeholder="Untuk keperluan apa..." value="${esc(tmpForm.note||'')}" oninput="sf('note',this.value)"></div>`;
  }else if(currentModalType==='inv'){
    body=`<div class="fg"><label>Nama Aset</label><input class="inp" placeholder="BBCA, Bitcoin, Reksa Dana XYZ..." value="${esc(tmpForm.name||'')}" oninput="sf('name',this.value)"></div>
    <div class="fg"><label>Jenis Investasi</label><select class="sel" onchange="sf('type',this.value)">${invTypeOpts}</select></div>
    <div class="fg"><label>Modal / Harga Beli (IDR)</label><input class="inp" type="number" placeholder="0" value="${tmpForm.buyAmount||''}" oninput="sf('buyAmount',this.value)"></div>
    <div class="fg"><label>Nilai Sekarang (IDR)</label><input class="inp" type="number" placeholder="0" value="${tmpForm.currentValue||''}" oninput="sf('currentValue',this.value)"></div>
    <div class="fg"><label>Catatan (opsional)</label><input class="inp" placeholder="Platform, jumlah lot, dll..." value="${esc(tmpForm.note||'')}" oninput="sf('note',this.value)"></div>`;
  }else if(currentModalType==='rates'){
    body=`<p class="muted" style="margin-bottom:10px">Nilai tukar 1 unit ke IDR</p>`+
    CURR.filter(c=>c!=='IDR').map(c=>`<div class="fg"><label>1 ${c} = Rp</label><input class="inp" type="number" value="${tmpRates[c]!==undefined?tmpRates[c]:rates[c]}" oninput="sfr('${c}',this.value)"></div>`).join('');
  }else if(currentModalType==='settings'){
    const st=getSyncStatus(),ls=getLastSync(),en=getSyncEnabled();
    const stColor=st==='ok'?'var(--green)':st==='error'?'var(--red)':'var(--text3)';
    const stIcon=st==='ok'?'🟢':st==='error'?'🔴':'⚪';
    const stLabel=st==='ok'?`Tersinkron · ${ls}`:st==='error'?'Gagal — cek koneksi internet':'Belum sync';
    body=`<div class="info-banner" style="margin-bottom:12px">📊 <span>Data otomatis masuk ke Google Sheets setiap simpan, dan ditarik saat buka app di perangkat manapun.</span></div>
    <div style="background:var(--bg3);border-radius:var(--radius);padding:.75rem;margin-bottom:12px">
      <div style="font-size:11px;color:var(--text2);margin-bottom:4px">Google Sheets URL</div>
      <div style="font-size:11px;color:var(--text3);word-break:break-all">${SHEETS_URL.substring(0,55)}...</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <span style="font-size:13px">Auto-sync aktif</span>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="sync-toggle" ${en?'checked':''} onchange="setSyncEnabled(this.checked)">
        <span style="font-size:13px">${en?'Ya':'Tidak'}</span>
      </label>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem .875rem;background:var(--bg3);border-radius:var(--radius);margin-bottom:12px">
      <div>
        <div style="font-size:12px;font-weight:500">${stIcon} Status</div>
        <div style="font-size:11px;color:${stColor};margin-top:2px">${stLabel}</div>
      </div>
    </div>
    <button class="btn-p" style="width:100%;justify-content:center;gap:8px" onclick="closeModal();pullFromSheets(false)">☁️ Tarik Data Terbaru dari Cloud</button>
    <div style="font-size:11px;color:var(--text3);margin-top:8px;text-align:center">Gunakan tombol ini saat ganti perangkat atau data tidak sinkron</div>`;
  }
  document.getElementById('modal-content').innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem"><span style="font-size:15px;font-weight:500">${titles[currentModalType]||''}</span><button class="btn-icon" onclick="closeModal()" style="font-size:16px">✕</button></div>${body}<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px"><button class="btn" onclick="closeModal()">Batal</button><button class="btn-p" onclick="saveModal()">✓ Simpan</button></div>`;
}

// ==================== SAVE MODAL ====================
function saveModal(){
  if(currentModalType==='tx'){
    if(!tmpForm.amount||!tmpForm.description)return alert('Isi nominal dan deskripsi ya!');
    const amt=parseFloat(tmpForm.amount);
    const amtIDR=toIDR(amt,tmpForm.currency||'IDR');
    const cat=(tmpForm.type==='income')?'lainnya':(tmpForm.category||'lainnya');
    const item={type:tmpForm.type||'expense',amount:amt,amountIDR:amtIDR,currency:tmpForm.currency||'IDR',category:cat,description:tmpForm.description,date:tmpForm.date||today(),note:tmpForm.note||'',accountId:tmpForm.accountId||'',accountName:getAccName(tmpForm.accountId||'')};
    if(editId){setTx(getTx().map(t=>t.id===editId?{...t,...item}:t));syncSheets('upsert_tx',{id:editId,...item});}
    else{const ni={id:uid(),...item};setTx([ni,...getTx()]);syncSheets('upsert_tx',ni);}
  }else if(currentModalType==='account'){
    if(!tmpForm.name)return alert('Isi nama akun!');
    const item={name:tmpForm.name,type:tmpForm.accType||'cash',initialBalance:parseFloat(tmpForm.initialBalance)||0,color:tmpForm.color||'#3B82F6'};
    if(editId)setAccounts(getAccounts().map(a=>a.id===editId?{...a,...item}:a));
    else setAccounts([...getAccounts(),{id:uid(),...item}]);
  }else if(currentModalType==='transfer'){
    if(!tmpForm.fromId||!tmpForm.toId||!tmpForm.amount)return alert('Lengkapi data transfer!');
    if(tmpForm.fromId===tmpForm.toId)return alert('Akun asal dan tujuan tidak boleh sama!');
    const item={fromId:tmpForm.fromId,fromAccountName:getAccName(tmpForm.fromId),toId:tmpForm.toId,toAccountName:getAccName(tmpForm.toId),amount:parseFloat(tmpForm.amount),currency:tmpForm.currency||'IDR',date:tmpForm.date||today(),note:tmpForm.note||''};
    const ni={id:uid(),...item};setTransfers([ni,...getTransfers()]);syncSheets('upsert_transfer',ni);
  }else if(currentModalType==='budget'){
    if(!tmpForm.category||!tmpForm.limit)return alert('Isi kategori dan batas anggaran!');
    const fMonth=getMonth();
    const budgets=getBudgets();
    const ex=budgets.find(b=>b.category===tmpForm.category&&b.month===fMonth);
    if(ex)setBudgets(budgets.map(b=>b.id===ex.id?{...b,limit:parseFloat(tmpForm.limit)}:b));
    else setBudgets([...budgets,{id:uid(),category:tmpForm.category,limit:parseFloat(tmpForm.limit),month:fMonth}]);
  }else if(currentModalType==='saving'){
    if(!tmpForm.name||!tmpForm.target)return alert('Isi nama dan target!');
    const item={
      name:tmpForm.name,
      target:parseFloat(tmpForm.target)||0,
      current:tmpForm.accountId?0:parseFloat(tmpForm.current)||0,
      accountId:tmpForm.accountId||'',
      deadline:tmpForm.deadline||''
    };
    if(editId)setSavings(getSavings().map(s=>s.id===editId?{...s,...item}:s));
    else setSavings([...getSavings(),{id:uid(),...item}]);
  }else if(currentModalType==='debt'){
    if(!tmpForm.person||!tmpForm.amount)return alert('Isi nama dan nominal!');
    const amt=parseFloat(tmpForm.amount);
    const amtIDR=toIDR(amt,tmpForm.currency||'IDR');
    const baseItem={type:tmpForm.type||'utang',person:tmpForm.person,amount:amt,amountIDR:amtIDR,currency:tmpForm.currency||'IDR',dueDate:tmpForm.dueDate||'',note:tmpForm.note||'',paid:false};
    if(editId){setDebts(getDebts().map(d=>d.id===editId?{...d,...baseItem}:d));}
    else setDebts([...getDebts(),{id:uid(),...baseItem,date:today()}]);
  }else if(currentModalType==='inv'){
    if(!tmpForm.name||!tmpForm.buyAmount)return alert('Isi nama aset dan modal!');
    const item={name:tmpForm.name,type:tmpForm.type||'Saham',buyAmount:parseFloat(tmpForm.buyAmount)||0,currentValue:parseFloat(tmpForm.currentValue)||parseFloat(tmpForm.buyAmount)||0,note:tmpForm.note||''};
    if(editId){setInv(getInv().map(i=>i.id===editId?{...i,...item}:i));}
    else setInv([...getInv(),{id:uid(),...item,date:today()}]);
  }else if(currentModalType==='rates'){
    const nr={...getRates()};
    CURR.filter(c=>c!=='IDR').forEach(c=>{if(tmpRates[c]!==undefined&&!isNaN(tmpRates[c]))nr[c]=parseFloat(tmpRates[c]);});
    setRates(nr);
  }else if(currentModalType==='settings'){
    // settings saved live via checkbox onchange
  }
  closeModal();
}

// ==================== DELETE / UPDATE ====================
function deleteTx(id){if(confirm('Hapus transaksi ini?')){setTx(getTx().filter(t=>t.id!==id));syncSheets('delete_tx',{id});}}
function deleteBudget(id){if(confirm('Hapus anggaran ini?'))setBudgets(getBudgets().filter(b=>b.id!==id))}
function deleteSaving(id){if(confirm('Hapus target ini?'))setSavings(getSavings().filter(s=>s.id!==id))}
function deleteDebt(id){if(confirm('Hapus data ini?'))setDebts(getDebts().filter(d=>d.id!==id))}
function deleteInv(id){if(confirm('Hapus investasi ini?'))setInv(getInv().filter(i=>i.id!==id))}
function markDebtPaid(id){setDebts(getDebts().map(d=>d.id===id?{...d,paid:true}:d))}
function deleteAcc(id){if(confirm('Hapus akun ini? Data transaksi tidak ikut terhapus.'))setAccounts(getAccounts().filter(a=>a.id!==id))}
function deleteTransfer(id){if(confirm('Hapus transfer?')){setTransfers(getTransfers().filter(t=>t.id!==id));syncSheets('delete_transfer',{id});}}

// ==================== EXPORT ====================
function exportCSV(){
  const fMonth=getMonth();
  const allTx=getTx().filter(t=>t.date.startsWith(fMonth));
  const h=['Tanggal','Tipe','Akun','Kategori','Deskripsi','Nominal','Mata Uang','Nominal IDR','Catatan'];
  const rows=allTx.map(t=>[t.date,t.type==='income'?'Pemasukan':'Pengeluaran',t.accountName||'',CATS.find(c=>c.id===t.category)?.label||t.category,`"${(t.description||'').replace(/"/g,'""')}"`,t.amount,t.currency,Math.round(t.amountIDR),`"${(t.note||'').replace(/"/g,'""')}"`]);
  const csv='\uFEFF'+[h,...rows].map(r=>r.join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download=`DompetKu-${fMonth}.csv`;
  a.click();
}

// ==================== INIT ====================
render();
// Auto-tarik data dari Sheets saat pertama buka
if(getSyncEnabled()){
  pullFromSheets(true);
}
