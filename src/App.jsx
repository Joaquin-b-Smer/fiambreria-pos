import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

// Parser para tu Systel Cuora Max - Ticket 2005010029001
function parseSystel(code) {
  if (!/^\d{13}$/.test(code)) return null
  if (!code.startsWith('20') && !code.startsWith('21')) return null
  
  const plu = parseInt(code.substring(2, 6), 10) // 0501 -> 501
  const importe = parseInt(code.substring(6, 12), 10) // 002900 -> 2900
  // const check = code.substring(12,13)
  
  return { plu, importe }
}

export default function App() {
  const [productos, setProductos] = useState([])
  const [carrito, setCarrito] = useState([])
  const [filtro, setFiltro] = useState('')
  const [msg, setMsg] = useState('')
  
  const total = carrito.reduce((a,b)=>a+b.venta, 0)
  const gananciaTotal = carrito.reduce((a,b)=>a+b.ganancia, 0)

  const cargar = async () => {
    const { data } = await supabase.from('productos').select('*').order('plu')
    if(data) setProductos(data)
  }

  useEffect(() => { cargar() }, [])

  const agregar = (p, ventaDirecta = null) => {
    // Si es venta por balanza escaneada, ventaDirecta = importe del ticket
    const venta = ventaDirecta !== null ? ventaDirecta : p.precio_kg
    const peso = p.precio_kg > 0 ? venta / p.precio_kg : 1
    const costo = (p.costo_kg || 0) * peso
    const ganancia = venta - costo
    
    setCarrito([...carrito, { 
      plu: p.plu, nombre: p.nombre, peso: peso.toFixed(3), 
      venta, costo, ganancia 
    }])
    setFiltro('')
  }

  const handleInput = async (val) => {
    setFiltro(val)
    setMsg('')
    
    // 1. COMANDO: /add 501 PAPAS 29000 18000
    if (val.startsWith('/add ')) {
      const partes = val.split(' ')
      // /add 501 NOMBRE 29000 18000
      if(partes.length >= 5) {
        const plu = parseInt(partes[1])
        const costo = parseInt(partes[partes.length-1])
        const precio = parseInt(partes[partes.length-2])
        const nombre = partes.slice(2, -2).join(' ')
        const { error } = await supabase.from('productos').insert({ 
          plu, nombre, precio_kg: precio, costo_kg: costo 
        })
        if(!error) { setMsg(`✅ Agregado PLU ${plu} ${nombre}`); cargar(); setFiltro('') }
        else setMsg('❌ Error: ' + error.message)
      }
      return
    }
    // 2. COMANDO: /del 501
    if (val.startsWith('/del ')) {
      const plu = parseInt(val.split(' ')[1])
      if(plu) {
        const { error } = await supabase.from('productos').delete().eq('plu', plu)
        if(!error) { setMsg(`🗑️ Borrado PLU ${plu}`); cargar(); setFiltro('') }
      }
      return
    }
    
    // 3. ESCANEO SYSTEL: 2005010029001
    if (/^\d{13}$/.test(val)) {
      const parsed = parseSystel(val)
      if(parsed) {
        const prod = productos.find(p => p.plu === parsed.plu || p.plu === parseInt(String(parsed.plu).slice(-3)))
        // Busca por 501 y también por 0501
        const prodReal = productos.find(p => p.plu == parsed.plu || p.plu == 501 && parsed.plu == 501) || productos.find(p => String(p.plu).includes(String(parsed.plu)))
        const prodEncontrado = productos.find(p => p.plu === parsed.plu) || productos.find(p => p.plu === parsed.plu % 1000) || prod
        
        if (prodEncontrado) {
          agregar(prodEncontrado, parsed.importe)
          setMsg(`⚖️ Ticket: ${prodEncontrado.nombre} $${parsed.importe}`)
        } else {
          setMsg(`⚠️ PLU ${parsed.plu} no existe. Crealo con /add ${parsed.plu} NOMBRE PRECIO COSTO`)
        }
        return
      }
    }
  }

  const cobrar = async () => {
    if(total === 0) return
    await supabase.from('ventas').insert({ 
      total, ganancia: gananciaTotal, items: carrito 
    })
    alert(`COBRADO $${total}\nGanancia: $${gananciaTotal.toFixed(0)}`)
    setCarrito([])
  }

  const filtrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(filtro.toLowerCase()) || 
    String(p.plu).includes(filtro)
  )

  return (
    <div style={{ fontFamily:'Arial', padding:'20px', maxWidth:'900px', margin:'0 auto' }}>
      <h1 style={{textAlign:'center', background:'black', color:'white', padding:'15px'}}>LO DE ANY - POS v2</h1>
      
      <div style={{background:'#f5f5f5', padding:'10px', fontSize:'13px', marginBottom:'10px'}}>
        <b>Comandos:</b> <code>/add 501 PAPAS 29000 18000</code> | <code>/del 501</code> | Escaneá ticket Systel directo
      </div>

      <input placeholder="Buscar PLU/nombre o escaneá ticket / comando..." 
        value={filtro} onChange={e=>handleInput(e.target.value)}
        autoFocus
        style={{width:'100%', padding:'15px', fontSize:'18px', marginBottom:'5px', border:'3px solid black'}} />
      
      {msg && <div style={{padding:'8px', background:'yellow', marginBottom:'10px'}}>{msg}</div>}

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:'10px'}}>
        {filtro.length < 13 && filtrados.map(p=>(
          <button key={p.plu} onClick={()=>agregar(p)} 
            style={{padding:'12px', border:'2px solid black', background:'white', cursor:'pointer'}}>
            <div style={{fontSize:'24px'}}>{p.foto || '🧀'}</div>
            <div style={{fontWeight:'bold', fontSize:'12px'}}>{p.nombre}</div>
            <div style={{fontSize:'11px'}}>PLU {p.plu}</div>
            <div>${p.precio_kg}/kg</div>
          </button>
        ))}
      </div>

      <div style={{marginTop:'30px', borderTop:'3px solid black', paddingTop:'20px'}}>
        <h2>Carrito: {carrito.length} - Total ${total} | Ganancia ${gananciaTotal.toFixed(0)}</h2>
        {carrito.map((c,i)=><div key={i} style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #ddd'}}>
          <span>{c.nombre} {c.peso}kg</span><span>${c.venta} (G: ${c.ganancia.toFixed(0)})</span>
        </div>)}
        <br/>
        <button onClick={cobrar} style={{padding:'15px 30px', background:'black', color:'white', fontSize:'20px', cursor:'pointer'}}>COBRAR</button>
        <button onClick={()=>setCarrito([])} style={{padding:'15px', marginLeft:'10px', cursor:'pointer'}}>Limpiar</button>
      </div>

      <div style={{marginTop:'20px', fontSize:'12px', color:'#666'}}>
        Tabla productos necesita: plu (int), nombre (text), precio_kg (int), costo_kg (int)
      </div>
    </div>
  )
}