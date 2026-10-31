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
  
  const total = carrito.reduce((a,b)=>a+b.venta, 0)
  const gananciaTotal = carrito.reduce((a,b)=>a+b.ganancia, 0)

  const cargar = async () => {
    const { data } = await supabase.from('productos').select('*').order('plu')
    if(data) setProductos(data)
  }
  useEffect(() => { cargar() }, [])

  const agregar = (p, ventaDirecta = null) => {
    const venta = ventaDirecta !== null ? ventaDirecta : p.precio_kg
    const costoKg = getCosto(p)
    const peso = p.precio_kg > 0 ? venta / p.precio_kg : 1
    const costo = costoKg * peso
    const ganancia = venta - costo
    setCarrito([...carrito, { plu: p.plu, nombre: p.nombre, peso: peso.toFixed(3), venta, costo, ganancia, costoKg }])
    setFiltro('')
  }

  const borrarProducto = async (plu, nombre) => {
    if(!confirm(`¿Borrar ${nombre} (PLU ${plu})? Esta acción no se puede deshacer.`)) return
    const { error } = await supabase.from('productos').delete().eq('plu', plu)
    if(!error) { setMsg(`🗑️ Borrado ${nombre} PLU ${plu}`); cargar() }
    else setMsg('❌ Error: ' + error.message)
  }

  const guardarProducto = async () => {
    if(!nuevo.plu || !nuevo.nombre || !nuevo.precio || !nuevo.costo) {
      setMsg('❌ Completa todos los campos'); return
    }
    const { error } = await supabase.from('productos').insert({
      plu: parseInt(nuevo.plu),
      nombre: nuevo.nombre,
      precio_kg: parseInt(nuevo.precio),
      costo_kg: parseInt(nuevo.costo),
      categoria: nuevo.categoria
    })
    if(!error) {
      setMsg(`✅ Producto ${nuevo.nombre} PLU ${nuevo.plu} creado`)
      setShowAdd(false)
      setNuevo({ plu:'', nombre:'', precio:'', costo:'', categoria:'quesos' })
      cargar()
    } else setMsg('❌ Error: ' + error.message)
  }

  const handleInput = async (val) => {
    setFiltro(val); setMsg('')
    if (/^\d{13}$/.test(val)) {
      const parsed = parseSystel(val)
      if(parsed) {
        const prod = productos.find(p => p.plu == parsed.plu || p.plu == parsed.plu % 1000)
        if (prod) { agregar(prod, parsed.importe); setMsg(`⚖️ Ticket: ${prod.nombre} $${parsed.importe}`) }
        else setMsg(`⚠️ PLU ${parsed.plu} no existe. Crealo con + NUEVO PRODUCTO`)
        return
      }
    }
  }

  const cobrar = async () => {
    if(total === 0) return
    await supabase.from('ventas').insert({ total, ganancia: Math.round(gananciaTotal), items: carrito })
    alert(`COBRADO $${total}\nGanancia: $${gananciaTotal.toFixed(0)}`)
    setCarrito([])
  }

  const filtrados = productos.filter(p => p.nombre.toLowerCase().includes(filtro.toLowerCase()) || String(p.plu).includes(filtro))

  return (
    <div style={{ fontFamily:'Arial', padding:'20px', maxWidth:'900px', margin:'0 auto' }}>
      <h1 style={{textAlign:'center', background:'black', color:'white', padding:'15px'}}>LO DE ANY - POS v2.3</h1>
      
      <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
        <button onClick={()=>setShowAdd(true)} style={{padding:'12px 20px', background:'#22c55e', color:'white', fontWeight:'bold', fontSize:'16px', border:'none', cursor:'pointer', borderRadius:'6px'}}> + NUEVO PRODUCTO </button>
        <div style={{background:'#f5f5f5', padding:'10px', fontSize:'13px', flex:1, borderRadius:'6px'}}>Escaneá ticket Systel o buscá producto. Ahora podés borrar con la X roja.</div>
      </div>

      {showAdd && (
        <div style={{border:'3px solid #22c55e', padding:'20px', marginBottom:'20px', background:'#f0fdf4', borderRadius:'8px'}}>
          <h3 style={{marginTop:0}}>Agregar Producto</h3>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
            <input placeholder="PLU (ej: 502)" type="number" value={nuevo.plu} onChange={e=>setNuevo({...nuevo, plu:e.target.value})} style={{padding:'12px'}} />
            <select value={nuevo.categoria} onChange={e=>setNuevo({...nuevo, categoria:e.target.value})} style={{padding:'12px'}}>
              <option value="quesos">Quesos</option><option value="fiambres">Fiambres</option><option value="Extras">Extras</option>
            </select>
            <input placeholder="Nombre (ej: Jamón Crudo)" value={nuevo.nombre} onChange={e=>setNuevo({...nuevo, nombre:e.target.value})} style={{padding:'12px', gridColumn:'span 2'}} />
            <input placeholder="Precio venta x KG" type="number" value={nuevo.precio} onChange={e=>setNuevo({...nuevo, precio:e.target.value})} style={{padding:'12px'}} />
            <input placeholder="Costo x KG" type="number" value={nuevo.costo} onChange={e=>setNuevo({...nuevo, costo:e.target.value})} style={{padding:'12px'}} />
          </div>
          {nuevo.precio && nuevo.costo && <div style={{marginTop:'10px', background:'white', padding:'10px'}}>Ganancia: ${parseInt(nuevo.precio)-parseInt(nuevo.costo)}/kg ({(((parseInt(nuevo.precio)-parseInt(nuevo.costo))/parseInt(nuevo.precio))*100).toFixed(0)}%)</div>}
          <div style={{marginTop:'15px', display:'flex', gap:'10px'}}>
            <button onClick={guardarProducto} style={{padding:'12px 25px', background:'black', color:'white', fontWeight:'bold', cursor:'pointer'}}>GUARDAR</button>
            <button onClick={()=>setShowAdd(false)} style={{padding:'12px 25px', cursor:'pointer'}}>Cancelar</button>
          </div>
        </div>
      )}

      <input placeholder="Buscar o escaneá ticket..." value={filtro} onChange={e=>handleInput(e.target.value)} autoFocus style={{width:'100%', padding:'15px', fontSize:'18px', marginBottom:'10px', border:'3px solid black'}} />
      {msg && <div style={{padding:'10px', background:'yellow', marginBottom:'10px', borderRadius:'5px'}}>{msg}</div>}
      
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:'12px'}}>
        {filtro.length < 13 && filtrados.map(p=>(
          <div key={p.plu} style={{position:'relative', border:'2px solid black', background:'white', padding:'12px', textAlign:'center', borderRadius:'6px'}}>
            <button onClick={()=>borrarProducto(p.plu, p.nombre)} title="Borrar producto" style={{position:'absolute', top:'5px', right:'5px', background:'#ef4444', color:'white', border:'none', borderRadius:'50%', width:'24px', height:'24px', cursor:'pointer', fontWeight:'bold'}}>X</button>
            <div onClick={()=>agregar(p)} style={{cursor:'pointer'}}>
              <div style={{fontSize:'24px'}}>🧀</div>
              <div style={{fontWeight:'bold', fontSize:'13px'}}>{p.nombre}</div>
              <div style={{fontSize:'11px', color:'#555'}}>PLU {p.plu} | Costo ${getCosto(p)}</div>
              <div style={{fontWeight:'bold'}}>${p.precio_kg}/kg</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{marginTop:'30px', borderTop:'3px solid black', paddingTop:'20px'}}>
        <h2>Carrito: {carrito.length} - Total ${total} | Ganancia ${gananciaTotal.toFixed(0)}</h2>
        {carrito.map((c,i)=><div key={i} style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #ddd', padding:'6px 0'}}>
          <span>{c.nombre} {c.peso}kg</span><span>${c.venta} (G: ${c.ganancia.toFixed(0)})</span>
        </div>)}
        <br/>
        <button onClick={cobrar} style={{padding:'15px 30px', background:'black', color:'white', fontSize:'20px', cursor:'pointer'}}>COBRAR</button>
        <button onClick={()=>setCarrito([])} style={{padding:'15px', marginLeft:'10px', cursor:'pointer'}}>Limpiar</button>
      </div>
    </div>
  )
}