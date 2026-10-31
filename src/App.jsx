import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function parseSystel(code) {
  if (!/^\d{13}$/.test(code)) return null
  if (!code.startsWith('20') && !code.startsWith('21')) return null
  const plu = parseInt(code.substring(2, 6), 10)
  const importe = parseInt(code.substring(6, 12), 10)
  return { plu, importe }
}
function getCosto(p) { return p.costo_kg ?? p["costo kg"] ?? 0 }

export default function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [productos, setProductos] = useState([])
  const [carrito, setCarrito] = useState([])
  const [filtro, setFiltro] = useState('')
  const [msg, setMsg] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [nuevo, setNuevo] = useState({ plu:'', nombre:'', precio:'', costo:'', categoria:'quesos' })
  const [showResumen, setShowResumen] = useState(false)
  const [ventasDia, setVentasDia] = useState([])

  const total = carrito.reduce((a,b)=>a+b.venta, 0)
  const gananciaTotal = carrito.reduce((a,b)=>a+b.ganancia, 0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setMsg('') })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); setMsg('') })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { if(session) cargar() }, [session])
  const cargar = async () => {
    const { data } = await supabase.from('productos').select('*').order('plu')
    if(data) setProductos(data)
  }

  const login = async () => {
    setMsg('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if(error) setMsg('❌ ' + error.message)
  }
  const logout = async () => { await supabase.auth.signOut(); setCarrito([]) }
  
  const cargarResumen = async () => {
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    const { data } = await supabase.from('ventas').select('*').gte('created_at', hoy.toISOString()).order('created_at', {ascending:false})
    if(data) setVentasDia(data)
    setShowResumen(true)
  }

  const cerrarCaja = async () => {
    if(!confirm(`¿Cerrar caja de hoy?\n\nTotal: $${totalDia}\nGanancia: $${gananciaDia}\nTickets: ${ventasDia.length}\n\nEsto va a archivar y limpiar la pantalla de hoy.`)) return
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    // Guardamos cierre para historial
    await supabase.from('ventas').insert({ total: -1, ganancia: gananciaDia, items: [{ cierre: `CIERRE CAJA ${new Date().toLocaleString()} Total $${totalDia} Ganancia $${gananciaDia}` }] })
    setVentasDia([])
    setShowResumen(false)
    setMsg(`✅ Caja cerrada: $${totalDia} recaudado. Pantalla limpiada.`)
  }

  const agregar = (p, ventaDirecta = null) => {
    const venta = ventaDirecta !== null ? ventaDirecta : p.precio_kg
    const costoKg = getCosto(p)
    const peso = p.precio_kg > 0 ? venta / p.precio_kg : 1
    setCarrito([...carrito, { plu: p.plu, nombre: p.nombre, peso: peso.toFixed(3), venta, costo: costoKg * peso, ganancia: venta - (costoKg*peso), costoKg }])
    setFiltro('')
  }
  const borrarProducto = async (plu, nombre) => {
    if(!confirm(`¿Borrar ${nombre} PLU ${plu}?`)) return
    await supabase.from('productos').delete().eq('plu', plu)
    setMsg(`🗑️ Borrado ${nombre}`); cargar()
  }
  const guardarProducto = async () => {
    if(!nuevo.plu || !nuevo.nombre || !nuevo.precio || !nuevo.costo) { setMsg('❌ Completa todo'); return }
    const { error } = await supabase.from('productos').insert({ plu: parseInt(nuevo.plu), nombre: nuevo.nombre, precio_kg: parseInt(nuevo.precio), costo_kg: parseInt(nuevo.costo), categoria: nuevo.categoria })
    if(!error) { setMsg(`✅ ${nuevo.nombre} creado`); setShowAdd(false); setNuevo({ plu:'', nombre:'', precio:'', costo:'', categoria:'quesos' }); cargar() }
    else setMsg('❌ '+error.message)
  }
  const handleInput = async (val) => {
    setFiltro(val); setMsg('')
    if (/^\d{13}$/.test(val)) {
      const parsed = parseSystel(val)
      if(parsed) {
        const prod = productos.find(p => p.plu == parsed.plu || p.plu == parsed.plu % 1000)
        if(prod) { agregar(prod, parsed.importe); setMsg(`⚖️ ${prod.nombre} $${parsed.importe}`) }
      }
    }
  }
  const cobrarEImprimir = async () => {
    if(total===0) return
    await supabase.from('ventas').insert({ total, ganancia: Math.round(gananciaTotal), items: carrito })
    window.print()
    setTimeout(()=>{ alert(`COBRADO $${total}`); setCarrito([]); cargarResumen() }, 500)
  }

  const filtrados = productos.filter(p => p.nombre.toLowerCase().includes(filtro.toLowerCase()) || String(p.plu).includes(filtro))
  const totalDia = ventasDia.filter(v=>v.total>0).reduce((a,b)=>a+b.total,0)
  const gananciaDia = ventasDia.filter(v=>v.total>0).reduce((a,b)=>a+(b.ganancia||0),0)

  // Desglose por producto del día
  const desglose = {}
  ventasDia.filter(v=>v.total>0).forEach(v=>{
    (v.items||[]).forEach(i=>{
      if(!desglose[i.nombre]) desglose[i.nombre] = { kg:0, total:0, ganancia:0, veces:0 }
      desglose[i.nombre].kg += parseFloat(i.peso||0)
      desglose[i.nombre].total += i.venta||0
      desglose[i.nombre].ganancia += i.ganancia||0
      desglose[i.nombre].veces += 1
    })
  })

  if(!session) {
    return (
      <div style={{fontFamily:'Arial', maxWidth:'350px', margin:'100px auto', padding:'30px', border:'3px solid black', textAlign:'center'}}>
        <h1 style={{background:'black', color:'white', padding:'10px'}}>LO DE ANY - LOGIN</h1>
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%', padding:'12px', margin:'10px 0', fontSize:'16px'}} />
        <input placeholder="Contraseña" type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} style={{width:'100%', padding:'12px', margin:'10px 0', fontSize:'16px'}} />
        <button onClick={login} style={{width:'100%', padding:'15px', background:'black', color:'white', fontSize:'18px', fontWeight:'bold', cursor:'pointer'}}>ENTRAR</button>
        {msg && <div style={{marginTop:'15px', background:'yellow', padding:'10px'}}>{msg}</div>}
      </div>
    )
  }

  return (
    <div style={{ fontFamily:'Arial', padding:'20px', maxWidth:'900px', margin:'0 auto' }}>
      <style>{`@media print { body * { visibility: hidden; } #ticket, #ticket * { visibility: visible; } #ticket { position: absolute; left:0; top:0; width:100%; } .no-print { display:none !important; } }`}</style>
      <div className="no-print" style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'black', color:'white', padding:'10px 15px'}}>
        <h1 style={{margin:0, fontSize:'18px'}}>LO DE ANY - POS v2.6</h1>
        <div><span style={{fontSize:'12px', marginRight:'10px'}}>{session.user.email}</span><button onClick={logout} style={{padding:'5px 10px', cursor:'pointer'}}>Salir</button></div>
      </div>
      <div className="no-print" style={{display:'flex', gap:'8px', margin:'15px 0', flexWrap:'wrap'}}>
        <button onClick={()=>setShowAdd(true)} style={{padding:'12px 16px', background:'#22c55e', color:'white', fontWeight:'bold', border:'none', cursor:'pointer', borderRadius:'6px'}}> + PRODUCTO </button>
        <button onClick={cargarResumen} style={{padding:'12px 16px', background:'#3b82f6', color:'white', fontWeight:'bold', border:'none', cursor:'pointer', borderRadius:'6px'}}> 📊 RESUMEN DEL DIA </button>
      </div>

      {showResumen && (
        <div className="no-print" style={{border:'3px solid #3b82f6', padding:'20px', marginBottom:'20px', background:'#eff6ff', borderRadius:'10px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h2 style={{margin:0}}>📊 Resumen {new Date().toLocaleDateString()}</h2>
            <button onClick={()=>setShowResumen(false)} style={{padding:'5px 12px', cursor:'pointer'}}>X</button>
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginTop:'15px'}}>
            <div style={{background:'black', color:'white', padding:'15px', borderRadius:'8px', textAlign:'center'}}>
              <div style={{fontSize:'12px'}}>TOTAL RECAUDADO</div><div style={{fontSize:'26px', fontWeight:'bold'}}>${totalDia}</div>
            </div>
            <div style={{background:'#22c55e', color:'white', padding:'15px', borderRadius:'8px', textAlign:'center'}}>
              <div style={{fontSize:'12px'}}>GANANCIA REAL</div><div style={{fontSize:'26px', fontWeight:'bold'}}>${gananciaDia}</div>
            </div>
            <div style={{background:'white', border:'2px solid black', padding:'15px', borderRadius:'8px', textAlign:'center'}}>
              <div style={{fontSize:'12px'}}>TICKETS</div><div style={{fontSize:'26px', fontWeight:'bold'}}>{ventasDia.filter(v=>v.total>0).length}</div>
            </div>
          </div>

          <h3 style={{marginTop:'20px'}}>Productos vendidos hoy:</h3>
          <div style={{background:'white', borderRadius:'8px', padding:'10px'}}>
            {Object.keys(desglose).length===0 ? <div style={{padding:'10px', color:'#888'}}>Sin ventas hoy</div> :
              Object.entries(desglose).map(([nombre, d])=>(
                <div key={nombre} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #eee', fontSize:'14px'}}>
                  <span><b>{nombre}</b> - {d.veces} ventas - {d.kg.toFixed(3)}kg</span>
                  <span>${d.total} <small style={{color:'green'}}>(G:${d.ganancia.toFixed(0)})</small></span>
                </div>
              ))
            }
          </div>

          <h4 style={{marginTop:'15px'}}>Detalle por ticket:</h4>
          <div style={{maxHeight:'200px', overflowY:'auto', background:'white', padding:'10px', borderRadius:'8px'}}>
            {ventasDia.filter(v=>v.total>0).map((v,i)=><div key={i} style={{display:'flex', justifyContent:'space-between', padding:'4px 0', fontSize:'13px', borderBottom:'1px solid #f0f0f0'}}>
              <span>{new Date(v.created_at).toLocaleTimeString()} - {(v.items||[]).map(it=>it.nombre).join(', ')}</span><span><b>${v.total}</b></span>
            </div>)}
          </div>

          <div style={{marginTop:'20px', display:'flex', gap:'10px'}}>
            <button onClick={()=>window.print()} style={{padding:'12px 20px', cursor:'pointer', border:'1px solid black'}}>🖨️ Imprimir resumen</button>
            <button onClick={cerrarCaja} style={{padding:'12px 20px', background:'#ef4444', color:'white', fontWeight:'bold', border:'none', cursor:'pointer', borderRadius:'6px'}}>🔒 CERRAR CAJA - Limpiar pantalla</button>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="no-print" style={{border:'3px solid #22c55e', padding:'20px', marginBottom:'20px', background:'#f0fdf4'}}>
          <h3 style={{marginTop:0}}>Nuevo Producto</h3>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
            <input placeholder="PLU" type="number" value={nuevo.plu} onChange={e=>setNuevo({...nuevo, plu:e.target.value})} style={{padding:'12px'}} />
            <select value={nuevo.categoria} onChange={e=>setNuevo({...nuevo, categoria:e.target.value})} style={{padding:'12px'}}><option value="quesos">Quesos</option><option value="fiambres">Fiambres</option><option value="Extras">Extras</option></select>
            <input placeholder="Nombre" value={nuevo.nombre} onChange={e=>setNuevo({...nuevo, nombre:e.target.value})} style={{padding:'12px', gridColumn:'span 2'}} />
            <input placeholder="Precio x KG" type="number" value={nuevo.precio} onChange={e=>setNuevo({...nuevo, precio:e.target.value})} style={{padding:'12px'}} />
            <input placeholder="Costo x KG" type="number" value={nuevo.costo} onChange={e=>setNuevo({...nuevo, costo:e.target.value})} style={{padding:'12px'}} />
          </div>
          <div style={{marginTop:'15px', display:'flex', gap:'10px'}}><button onClick={guardarProducto} style={{padding:'12px 25px', background:'black', color:'white', cursor:'pointer'}}>GUARDAR</button><button onClick={()=>setShowAdd(false)} style={{padding:'12px 25px', cursor:'pointer'}}>Cancelar</button></div>
        </div>
      )}

      <input className="no-print" placeholder="Buscar o ticket Systel..." value={filtro} onChange={e=>handleInput(e.target.value)} autoFocus style={{width:'100%', padding:'15px', fontSize:'18px', marginBottom:'10px', border:'3px solid black'}} />
      {msg && <div className="no-print" style={{padding:'10px', background:'yellow', marginBottom:'10px'}}>{msg}</div>}
      
      <div className="no-print" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:'12px'}}>
        {filtro.length < 13 && filtrados.map(p=>(
          <div key={p.plu} style={{position:'relative', border:'2px solid black', background:'white', padding:'12px', textAlign:'center', borderRadius:'6px'}}>
            <button onClick={()=>borrarProducto(p.plu, p.nombre)} style={{position:'absolute', top:'5px', right:'5px', background:'#ef4444', color:'white', border:'none', borderRadius:'50%', width:'24px', height:'24px', cursor:'pointer', fontWeight:'bold'}}>X</button>
            <div onClick={()=>agregar(p)} style={{cursor:'pointer'}}><div style={{fontSize:'24px'}}>🧀</div><div style={{fontWeight:'bold', fontSize:'13px'}}>{p.nombre}</div><div style={{fontSize:'11px'}}>PLU {p.plu} | Costo ${getCosto(p)}</div><div style={{fontWeight:'bold'}}>${p.precio_kg}/kg</div></div>
          </div>
        ))}
      </div>

      <div className="no-print" style={{marginTop:'30px', borderTop:'3px solid black', paddingTop:'20px'}}>
        <h2>Carrito: {carrito.length} - Total ${total} | Ganancia ${gananciaTotal.toFixed(0)}</h2>
        {carrito.map((c,i)=><div key={i} style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #ddd', padding:'6px 0'}}><span>{c.nombre} {c.peso}kg</span><span>${c.venta}</span></div>)}
        <br/>
        <button onClick={cobrarEImprimir} style={{padding:'15px 30px', background:'black', color:'white', fontSize:'18px', fontWeight:'bold', cursor:'pointer'}}>🖨️ COBRAR + IMPRIMIR</button>
        <button onClick={()=>setCarrito([])} style={{padding:'15px', marginLeft:'10px', cursor:'pointer'}}>Limpiar</button>
      </div>

      <div id="ticket" style={{padding:'20px', fontFamily:'monospace', maxWidth:'300px', margin:'0 auto'}}>
        <div style={{textAlign:'center', borderBottom:'2px dashed black', paddingBottom:'10px', marginBottom:'10px'}}><h2 style={{margin:'0'}}>LO DE ANY</h2><div>{new Date().toLocaleString()}</div></div>
        {carrito.map((c,i)=><div key={i} style={{display:'flex', justifyContent:'space-between'}}><span>{c.nombre} {c.peso}kg</span><span>${c.venta}</span></div>)}
        <div style={{borderTop:'2px dashed black', marginTop:'10px', paddingTop:'10px', fontWeight:'bold'}}><div style={{display:'flex', justifyContent:'space-between'}}><span>TOTAL:</span><span>${total}</span></div></div>
        {showResumen && (
          <div style={{marginTop:'20px'}}>
            <div style={{textAlign:'center', borderTop:'2px dashed black', paddingTop:'10px'}}><b>RESUMEN DEL DIA</b></div>
            <div>TOTAL RECAUDADO: ${totalDia}</div>
            <div>GANANCIA: ${gananciaDia}</div>
            <div>TICKETS: {ventasDia.filter(v=>v.total>0).length}</div>
          </div>
        )}
      </div>
    </div>
  )
}