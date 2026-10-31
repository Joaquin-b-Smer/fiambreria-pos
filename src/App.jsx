import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function parseSystel(code) {
  if (!/^\d{13}$/.test(code)) return null
  if (!code.startsWith('20') && !code.startsWith('21')) return null
  const plu = parseInt(code.substring(2, 6), 10)
  const importe = parseInt(code.substring(6, 12), 10)
  return { plu, importe }
}
function getCosto(p) {
  return p.costo_kg ?? p["costo kg"] ?? p.Costo_kg ?? p["Costo kg"] ?? p.costo ?? 0
}

export default function App() {
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

  const cargar = async () => {
    const { data } = await supabase.from('productos').select('*').order('plu')
    if(data) setProductos(data)
  }
  useEffect(() => { cargar() }, [])

  const cargarResumen = async () => {
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    const { data } = await supabase.from('ventas').select('*').gte('created_at', hoy.toISOString()).order('created_at', {ascending:false})
    if(data) setVentasDia(data)
    setShowResumen(true)
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
        else setMsg(`⚠️ PLU ${parsed.plu} no existe`)
        return
      }
    }
  }

  const cobrarEImprimir = async () => {
    if(total===0) return
    await supabase.from('ventas').insert({ total, ganancia: Math.round(gananciaTotal), items: carrito })
    window.print()
    setTimeout(()=>{ alert(`COBRADO $${total} Ganancia $${gananciaTotal.toFixed(0)}`); setCarrito([]) }, 500)
  }

  const cobrarSolo = async () => {
    if(total===0) return
    await supabase.from('ventas').insert({ total, ganancia: Math.round(gananciaTotal), items: carrito })
    alert(`COBRADO $${total} Ganancia $${gananciaTotal.toFixed(0)}`); setCarrito([])
  }

  const filtrados = productos.filter(p => p.nombre.toLowerCase().includes(filtro.toLowerCase()) || String(p.plu).includes(filtro))
  const totalDia = ventasDia.reduce((a,b)=>a+b.total,0)
  const gananciaDia = ventasDia.reduce((a,b)=>a+(b.ganancia||0),0)

  return (
    <div style={{ fontFamily:'Arial', padding:'20px', maxWidth:'900px', margin:'0 auto' }}>
      <style>{`@media print { body * { visibility: hidden; } #ticket, #ticket * { visibility: visible; } #ticket { position: absolute; left:0; top:0; width:100%; } .no-print { display:none !important; } }`}</style>
      
      <h1 className="no-print" style={{textAlign:'center', background:'black', color:'white', padding:'15px'}}>LO DE ANY - POS v2.4</h1>
      
      <div className="no-print" style={{display:'flex', gap:'8px', marginBottom:'15px', flexWrap:'wrap'}}>
        <button onClick={()=>setShowAdd(true)} style={{padding:'12px 16px', background:'#22c55e', color:'white', fontWeight:'bold', border:'none', cursor:'pointer', borderRadius:'6px'}}> + PRODUCTO </button>
        <button onClick={cargarResumen} style={{padding:'12px 16px', background:'#3b82f6', color:'white', fontWeight:'bold', border:'none', cursor:'pointer', borderRadius:'6px'}}> 📊 RESUMEN DEL DÍA </button>
        <div style={{flex:1, background:'#f5f5f5', padding:'10px', fontSize:'12px', borderRadius:'6px'}}>Total Hoy: ${totalDia} | Ganancia: ${gananciaDia}</div>
      </div>

      {showResumen && (
        <div className="no-print" style={{border:'3px solid #3b82f6', padding:'20px', marginBottom:'20px', background:'#eff6ff', borderRadius:'8px'}}>
          <div style={{display:'flex', justifyContent:'space-between'}}><h3 style={{marginTop:0}}>📊 Resumen de Hoy - {new Date().toLocaleDateString()}</h3><button onClick={()=>setShowResumen(false)} style={{cursor:'pointer'}}>X Cerrar</button></div>
          <h2>Total Vendido: ${totalDia} | Ganancia: ${gananciaDia} | Tickets: {ventasDia.length}</h2>
          {ventasDia.map((v,i)=><div key={i} style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #ccc', padding:'6px 0', fontSize:'14px'}}>
            <span>{new Date(v.created_at).toLocaleTimeString()} - {v.items?.length || 0} prod</span><span><b>${v.total}</b> (G: ${v.ganancia})</span>
          </div>)}
          <button onClick={()=>window.print()} style={{marginTop:'15px', padding:'10px 20px', cursor:'pointer'}}>🖨️ Imprimir cierre</button>
        </div>
      )}

      {showAdd && (
        <div className="no-print" style={{border:'3px solid #22c55e', padding:'20px', marginBottom:'20px', background:'#f0fdf4', borderRadius:'8px'}}>
          <h3 style={{marginTop:0}}>Agregar Producto</h3>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
            <input placeholder="PLU" type="number" value={nuevo.plu} onChange={e=>setNuevo({...nuevo, plu:e.target.value})} style={{padding:'12px'}} />
            <select value={nuevo.categoria} onChange={e=>setNuevo({...nuevo, categoria:e.target.value})} style={{padding:'12px'}}><option value="quesos">Quesos</option><option value="fiambres">Fiambres</option><option value="Extras">Extras</option></select>
            <input placeholder="Nombre" value={nuevo.nombre} onChange={e=>setNuevo({...nuevo, nombre:e.target.value})} style={{padding:'12px', gridColumn:'span 2'}} />
            <input placeholder="Precio venta x KG" type="number" value={nuevo.precio} onChange={e=>setNuevo({...nuevo, precio:e.target.value})} style={{padding:'12px'}} />
            <input placeholder="Costo x KG" type="number" value={nuevo.costo} onChange={e=>setNuevo({...nuevo, costo:e.target.value})} style={{padding:'12px'}} />
          </div>
          <div style={{marginTop:'15px', display:'flex', gap:'10px'}}>
            <button onClick={guardarProducto} style={{padding:'12px 25px', background:'black', color:'white', fontWeight:'bold', cursor:'pointer'}}>GUARDAR</button>
            <button onClick={()=>setShowAdd(false)} style={{padding:'12px 25px', cursor:'pointer'}}>Cancelar</button>
          </div>
        </div>
      )}

      <input className="no-print" placeholder="Buscar o escaneá ticket Systel..." value={filtro} onChange={e=>handleInput(e.target.value)} autoFocus style={{width:'100%', padding:'15px', fontSize:'18px', marginBottom:'10px', border:'3px solid black'}} />
      {msg && <div className="no-print" style={{padding:'10px', background:'yellow', marginBottom:'10px', borderRadius:'5px'}}>{msg}</div>}
      
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
        {carrito.map((c,i)=><div key={i} style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #ddd', padding:'6px 0'}}><span>{c.nombre} {c.peso}kg</span><span>${c.venta} (G: ${c.ganancia.toFixed(0)})</span></div>)}
        <br/>
        <div style={{display:'flex', gap:'10px'}}>
          <button onClick={cobrarEImprimir} style={{padding:'15px 30px', background:'black', color:'white', fontSize:'18px', fontWeight:'bold', cursor:'pointer'}}>🖨️ COBRAR + IMPRIMIR</button>
          <button onClick={cobrarSolo} style={{padding:'15px 20px', cursor:'pointer'}}>Solo Cobrar</button>
          <button onClick={()=>setCarrito([])} style={{padding:'15px', cursor:'pointer'}}>Limpiar</button>
        </div>
      </div>

      <div id="ticket" style={{padding:'20px', fontFamily:'monospace', maxWidth:'300px', margin:'0 auto'}}>
        <div style={{textAlign:'center', borderBottom:'2px dashed black', paddingBottom:'10px', marginBottom:'10px'}}>
          <h2 style={{margin:'0'}}>LO DE ANY</h2>
          <div>Fiambrería</div>
          <div>{new Date().toLocaleString()}</div>
        </div>
        {carrito.map((c,i)=><div key={i} style={{display:'flex', justifyContent:'space-between', fontSize:'14px', marginBottom:'4px'}}>
          <span>{c.nombre} {c.peso}kg</span><span>${c.venta}</span>
        </div>)}
        <div style={{borderTop:'2px dashed black', marginTop:'10px', paddingTop:'10px', fontWeight:'bold'}}>
          <div style={{display:'flex', justifyContent:'space-between'}}><span>TOTAL:</span><span>${total}</span></div>
          <div style={{fontSize:'12px', marginTop:'5px'}}>¡Gracias por su compra!</div>
        </div>
      </div>
    </div>
  )
}