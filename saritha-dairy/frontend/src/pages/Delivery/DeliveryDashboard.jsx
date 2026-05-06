// src/pages/Delivery/DeliveryDashboard.jsx
import React, { useState, useEffect } from 'react';
import './DeliveryDashboard.css';

const API_URL = 'https://saritha-dairy-api.onrender.com/api';

const DeliveryDashboard = () => {
  const [customers, setCustomers] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayStats, setTodayStats] = useState({ deliveries: 0, collected: 0, pending: 0 });
  const [deliveringId, setDeliveringId] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [expandedApt, setExpandedApt] = useState(null);
  const [extraOrdersCount, setExtraOrdersCount] = useState(0);
  const [showBanner, setShowBanner] = useState(true);
  const [pulseAnim, setPulseAnim] = useState(false);

  const getUserData = () => { try { return JSON.parse(sessionStorage.getItem('userData')); } catch { return null; } };
  const getToken = () => sessionStorage.getItem('authToken');
  const getAuthHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` });
  const userData = getUserData();

  useEffect(() => {
    if (!userData?.id) { window.location.href = '/login'; return; }
    loadAllData();
    const t1 = setInterval(() => setCurrentTime(new Date()), 60000);
    const t2 = setInterval(() => setPulseAnim(p => !p), 3000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [custRes, todayRes] = await Promise.all([
        fetch(`${API_URL}/delivery-boys/${userData.id}/customers`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/delivery/today/${userData.id}`, { headers: getAuthHeaders() })
      ]);
      if (custRes.status === 401) { sessionStorage.clear(); window.location.href = '/login'; return; }
      
      const custData = await custRes.json();
      const todayData = await todayRes.json();
      const todayDeliveries = todayData.success ? todayData.data : [];

      let prefsMap = {}, ordersMap = {}, totalExtra = 0;
      try {
        const [prefsRes, ordersRes] = await Promise.all([
          fetch(`${API_URL}/customer-preferences/all/list`, { headers: getAuthHeaders() }),
          fetch(`${API_URL}/customer-preferences/extra-orders/all`, { headers: getAuthHeaders() })
        ]);
        const prefsData = await prefsRes.json();
        const ordersData = await ordersRes.json();
        
        if (prefsData.success) prefsData.data.forEach(p => { prefsMap[p.customer_id] = { wantMilk: p.want_milk, quantity: p.quantity||2, packSize: p.pack_size||'500ml', skipDays: typeof p.skip_days==='string'?JSON.parse(p.skip_days):(p.skip_days||[]) }; });
        if (ordersData.success) ordersData.data.forEach(o => { ordersMap[o.customerId] = o.orders; totalExtra += o.orders.filter(or=>or.status!=='delivered').length; });
        setExtraOrdersCount(totalExtra);
      } catch(e) {}

      if (custData.success) {
        const enriched = custData.data.map(c => ({
          ...c, delivered: todayDeliveries.some(d=>d.customer_id==c.id),
          deliveryData: todayDeliveries.find(d=>d.customer_id==c.id)||null,
          products: c.products||[], preferences: prefsMap[c.id]||{wantMilk:true,quantity:2,packSize:'500ml',skipDays:[]},
          extraOrders: ordersMap[c.id]||[]
        }));
        enriched.sort((a,b)=>a.delivered===b.delivered?(a.apartment||'').localeCompare(b.apartment||''):a.delivered?1:-1);
        setCustomers(enriched);
        const done = enriched.filter(c=>c.delivered);
        setTodayStats({ deliveries: done.length, collected: done.reduce((s,c)=>s+(parseFloat(c.deliveryData?.total_amount)||0),0), pending: enriched.filter(c=>!c.delivered).length });
      }
    } catch(e) { showMessage('error','Failed to load'); }
    setLoading(false);
  };

  const markDelivered = async (customerId) => {
    const customer = customers.find(c=>c.id==customerId);
    if (!customer||deliveringId) return;
    if (isPaused(customer)) { showMessage('error',`⚠️ Paused!`); return; }
    if (isSkipDay(customer)) { showMessage('error',`⚠️ Skip day!`); return; }
    setDeliveringId(customerId);
    const prods = customer.products||[];
    const total = prods.reduce((s,p)=>s+((p.price||0)*(p.quantity||p.quantity_per_day||1)),0);
    try {
      const res = await fetch(`${API_URL}/delivery/record`, { method:'POST', headers:getAuthHeaders(),
        body:JSON.stringify({ customer_id:parseInt(customerId), delivery_boy_id:parseInt(userData.id), delivery_date:new Date().toISOString().split('T')[0], products:prods.map(p=>({product_name:p.product_name,pack_size:p.pack_size,quantity:parseInt(p.quantity||p.quantity_per_day||1),price:parseFloat(p.price||0)})), status:'delivered', total_amount:total }) });
      const data = await res.json();
      if (data.success) {
        if (customer.extraOrders?.length) {
          const today = new Date().toISOString().split('T')[0];
          await fetch(`${API_URL}/customer-preferences/${customerId}`, { method:'POST', headers:getAuthHeaders(),
            body:JSON.stringify({ wantMilk:customer.preferences?.wantMilk??true, quantity:customer.preferences?.quantity??2, packSize:customer.preferences?.packSize??'500ml', skipDays:customer.preferences?.skipDays||[], extraOrders:customer.extraOrders.map(o=>o.date===today?{...o,status:'delivered'}:o) }) }).catch(()=>{});
        }
        setCustomers(prev=>{
          const today = new Date().toISOString().split('T')[0];
          const u = prev.map(c=>c.id==customerId?{...c,delivered:true,deliveryData:{total_amount:total},extraOrders:(c.extraOrders||[]).map(o=>o.date===today?{...o,status:'delivered'}:o)}:c);
          const done = u.filter(c=>c.delivered);
          setTodayStats({ deliveries:done.length, collected:done.reduce((s,c)=>s+(parseFloat(c.deliveryData?.total_amount)||0),0), pending:u.filter(c=>!c.delivered).length });
          setExtraOrdersCount(u.reduce((s,c)=>s+(c.extraOrders||[]).filter(o=>o.status!=='delivered').length,0));
          return u;
        });
        showMessage('success',`✅ ${customer.name}`);
      } else showMessage('error',data.error);
    } catch(e) { showMessage('error','Failed'); }
    setDeliveringId(null);
  };

  const undoDelivery = (cid) => {
    setCustomers(prev=>{ const u=prev.map(c=>c.id==cid?{...c,delivered:false,deliveryData:null}:c); setTodayStats({ deliveries:u.filter(c=>c.delivered).length, collected:u.filter(c=>c.delivered).reduce((s,c)=>s+(parseFloat(c.deliveryData?.total_amount)||0),0), pending:u.filter(c=>!c.delivered).length }); return u; });
    showMessage('success','↩️ Undone');
  };

  const showMessage = (type,text) => { setMessage({type,text}); setTimeout(()=>setMessage(null),2500); };
  const handleLogout = () => { sessionStorage.clear(); window.location.href='/login'; };

  const getGreeting = () => { const h=currentTime.getHours(); if(h<12)return{text:'Good Morning',icon:'🌅',tod:'morning'}; if(h<17)return{text:'Good Afternoon',icon:'☀️',tod:'afternoon'}; return{text:'Good Evening',icon:'🌙',tod:'evening'}; };
  const getAptIcon = (n) => ({'A':'🏢','B':'🏬','C':'🏗️','D':'🏘️'}[n?.charAt(0)?.toUpperCase()]||'🏢');
  const getAptGrad = (g) => g.pendingCount===0?'linear-gradient(135deg,#e8f5e9,#c8e6c9)':g.completedCount>0?'linear-gradient(135deg,#fff8e1,#ffecb3)':'linear-gradient(135deg,#f5f5f5,#eee)';
  const isPaused = (c) => c.preferences?.wantMilk===false;
  const getMilk = (c) => !c.preferences?'':!c.preferences.wantMilk?'⏸️ Paused':`${c.preferences.quantity||2}×${c.preferences.packSize||'500ml'}`;
  const isSkip = (c) => c.preferences?.skipDays?.length?c.preferences.skipDays.includes(new Date().toLocaleDateString('en-US',{weekday:'short'})):false;

  const pendingC = customers.filter(c=>!c.delivered);
  const completedC = customers.filter(c=>c.delivered);
  const progress = customers.length?Math.round((completedC.length/customers.length)*100):0;
  const greeting = getGreeting();
  const displayC = activeTab==='pending'?pendingC:completedC;
  const filtered = displayC.filter(c=>(c.name||'').toLowerCase().includes(searchTerm.toLowerCase())||(c.phone||'').includes(searchTerm)||(c.apartment||'').toLowerCase().includes(searchTerm.toLowerCase())||(c.flat_no||'').toLowerCase().includes(searchTerm.toLowerCase()));

  const aptGroups = (()=>{const g={};filtered.forEach(c=>{const a=c.apartment||'Other';if(!g[a])g[a]={name:a,customers:[],totalAmount:0,completedCount:0,pendingCount:0};const t=(c.products||[]).reduce((s,p)=>s+((p.price||0)*(p.quantity||p.quantity_per_day||1)),0);g[a].customers.push(c);g[a].totalAmount+=t;if(c.delivered)g[a].completedCount++;else g[a].pendingCount++;});return Object.values(g).sort((a,b)=>a.name.localeCompare(b.name));})();

  if (loading) return (<div className="dd-load"><div className="dd-load-scooter">🛵</div><p>Loading route...</p></div>);

  return (
    <div className={`dd-app ${greeting.tod}`}>
      {message && <div className={`dd-toast ${message.type}`}><span>{message.text}</span><button onClick={()=>setMessage(null)}>×</button></div>}

      {/* Header */}
      <header className="dd-hdr">
        <div className="dd-hdr-user" onClick={()=>setShowProfile(!showProfile)}>
          <div className="dd-hdr-avatar-ring"><div className="dd-hdr-avatar">{userData?.name?.charAt(0)?.toUpperCase()||'D'}</div><div className={`dd-hdr-pulse ${pulseAnim?'active':''}`}></div></div>
          <div><small>{greeting.icon} {greeting.text}</small><h2>{userData?.name||'Partner'}</h2></div>
        </div>
        <button className="dd-hdr-notif">🔔{(todayStats.pending+extraOrdersCount)>0&&<span className="dd-hdr-badge">{todayStats.pending+extraOrdersCount}</span>}</button>
      </header>

      {/* Banner */}
      {showBanner && extraOrdersCount>0 && (
        <div className="dd-banner">
          <span>🌅</span><div><strong>{extraOrdersCount} extra orders today</strong><p>Check customer cards below</p></div>
          <button onClick={()=>setShowBanner(false)}>×</button>
        </div>
      )}

      {/* Profile */}
      {showProfile && (
        <div className="dd-prof">
          <div className="dd-prof-avatar">{userData?.name?.charAt(0)}</div>
          <h3>{userData?.name}</h3><p>🛵 {userData?.vehicle} • {userData?.shift}</p>
          <div className="dd-prof-grid">
            <div><span>📱</span><span>{userData?.phone}</span></div>
            <div><span>📍</span><span>{userData?.area||'All'}</span></div>
            <div><span>💰</span><span>₹{userData?.salary}/mo</span></div>
          </div>
          <button onClick={handleLogout} className="dd-prof-logout">🚪 Logout</button>
        </div>
      )}

      <main className="dd-main">
        {/* HOME TAB */}
        {activeTab==='home'&&(<>
          <div className="dd-stats">
            <div className="dd-stat"><span>📦</span><strong>{customers.length}</strong><small>Total</small></div>
            <div className="dd-stat pending"><span>⏳</span><strong>{todayStats.pending}</strong><small>Pending</small></div>
            <div className="dd-stat done"><span>✅</span><strong>{todayStats.deliveries}</strong><small>Done</small></div>
            <div className="dd-stat cash"><span>💰</span><strong>₹{todayStats.collected}</strong><small>Cash</small></div>
          </div>

          <div className="dd-prog"><div className="dd-prog-bar"><div className="dd-prog-fill" style={{width:`${progress}%`}}>{progress>10&&<span>{progress}%</span>}</div></div></div>

          <div className="dd-quick"><button onClick={()=>setActiveTab('pending')}>🚀 Start</button><button onClick={()=>window.open('https://maps.google.com','_blank')}>🗺️ Map</button></div>

          <div className="dd-srch"><span>🔍</span><input placeholder="Search..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>{searchTerm&&<button onClick={()=>setSearchTerm('')}>×</button>}</div>

          <div className="dd-tabs">
            <button className={activeTab==='pending'?'active':''} onClick={()=>setActiveTab('pending')}>⏳ {pendingC.length} Pending</button>
            <button className={activeTab==='completed'?'active':''} onClick={()=>setActiveTab('completed')}>✅ {completedC.length} Done</button>
          </div>

          <div className="dd-list">
            {aptGroups.length===0?<div className="dd-empty"><span>{activeTab==='pending'?'🎉':'📭'}</span><p>{activeTab==='pending'?'All done!☕':'No deliveries'}</p></div>:
              aptGroups.map(group=>{
                const isExp=expandedApt===group.name;
                const pct=group.customers.length?Math.round((group.completedCount/group.customers.length)*100):0;
                const allDone=group.pendingCount===0;
                return (
                  <div key={group.name} className={`dd-bld ${isExp?'exp':''} ${allDone?'alldone':''}`}>
                    <div className="dd-bld-hdr" onClick={()=>setExpandedApt(isExp?null:group.name)} style={{background:getAptGrad(group)}}>
                      <span className="dd-bld-icon">{getAptIcon(group.name)}</span>
                      <div className="dd-bld-info"><strong>{group.name}</strong><small>{group.customers.length} flats • ₹{group.totalAmount}</small></div>
                      <div className="dd-bld-right">
                        <div className="dd-bld-ring"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" fill="none" stroke="#ddd" strokeWidth="3"/><circle cx="18" cy="18" r="14" fill="none" stroke={allDone?'#4caf50':'#f59e0b'} strokeWidth="3" strokeDasharray={`${pct*0.88} 88`} strokeLinecap="round" transform="rotate(-90 18 18)"/></svg><span>{pct}%</span></div>
                        <span className={`dd-bld-arr ${isExp?'up':''}`}>▼</span>
                      </div>
                    </div>
                    {isExp&&group.customers.map(c=>{
                      const prods=c.products||[];
                      const total=prods.reduce((s,p)=>s+((p.price||0)*(p.quantity||p.quantity_per_day||1)),0);
                      const paused=isPaused(c);const skip=isSkip(c);
                      const pOrders=(c.extraOrders||[]).filter(o=>o.status!=='delivered');
                      return (
                        <div key={c.id} className={`dd-crow ${c.delivered?'del':''} ${paused?'pau':''} ${skip?'skp':''}`}>
                          <div className="dd-crow-avatar" style={{background:paused?'#ef4444':skip?'#f59e0b':c.delivered?'#4caf50':'#667eea'}}>{c.name?.charAt(0)}</div>
                          <div className="dd-crow-info">
                            <strong>{c.name}{paused&&' ⏸️'}{skip&&' 🚫'}</strong>
                            <p>🚪{c.flat_no||'?'} · 🏢{c.apartment}</p>
                            <span className="dd-crow-milk">{getMilk(c)}</span>
                            {pOrders.length>0&&<div className="dd-crow-orders">{pOrders.map((o,i)=><span key={i}>{o.productName}({o.packSize})×{o.quantity}</span>)}</div>}
                          </div>
                          <div className="dd-crow-right">
                            <strong>₹{total}</strong>
                            <div className="dd-crow-acts">
                              <a href={`tel:${c.phone}`} className="dd-crow-btn">📞</a>
                              <button onClick={()=>{const a=[c.apartment,c.flat_no,c.area,'Hyderabad'].filter(Boolean).join(',');window.open(`https://maps.google.com/?q=${encodeURIComponent(a)}`,'_blank');}} className="dd-crow-btn">🗺️</button>
                              {(paused||skip)&&!c.delivered?<button className="dd-crow-block" onClick={()=>showMessage('error',paused?'Paused!':'Skip!')}>🚫</button>:
                               !c.delivered?<button className="dd-crow-done" onClick={()=>markDelivered(c.id)} disabled={deliveringId===c.id}>{deliveringId===c.id?'⏳':'✓'}</button>:
                               <button className="dd-crow-undo" onClick={()=>undoDelivery(c.id)}>↩</button>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            }
          </div>
        </>)}

        {/* HISTORY TAB */}
        {activeTab==='history'&&(
          <div className="dd-hist">
            <h3>📜 Today's Deliveries</h3>
            {completedC.length===0?<div className="dd-empty"><span>📭</span><p>No deliveries yet</p></div>:
              completedC.map(c=>(
                <div key={c.id} className="dd-hist-card">
                  <div className="dd-hist-dot"></div>
                  <div className="dd-hist-info">
                    <small>{new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</small>
                    <strong>{c.name}</strong>
                    <p>🚪{c.flat_no} · {(c.products||[]).map(p=>p.product_name).join(', ')}</p>
                    <span>₹{c.deliveryData?.total_amount||0}</span>
                  </div>
                  <button onClick={()=>undoDelivery(c.id)} className="dd-hist-undo">↩</button>
                </div>
              ))
            }
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="dd-nav">
        {[{id:'home',icon:'🏠',label:'Home'},{id:'pending',icon:'📋',label:'Pending',badge:todayStats.pending},{id:'history',icon:'📜',label:'History'},{id:'profile',icon:'👤',label:'Me'}].map(item=>(
          <button key={item.id} className={`dd-nav-item ${activeTab===item.id||(item.id==='pending'&&activeTab==='pending')?'active':''}`} onClick={()=>{if(item.id==='profile')setShowProfile(true);else if(item.id==='pending')setActiveTab('pending');else setActiveTab(item.id);}}>
            <span className="dd-nav-icon">{item.icon}</span><span className="dd-nav-label">{item.label}</span>
            {item.badge>0&&<span className="dd-nav-dot">{item.badge}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default DeliveryDashboard;