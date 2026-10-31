import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function App() {
  const [productos, setProductos] = useState([])
  const [carrito, setCarrito] = useState([])
  const [filtro, setFiltro] = useState('')
  
  const total = carrito.reduce((a,b)=>a+b.precio_kg, 0)

  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase.from('productos').select('*').order('nombre')
      if(data) setProductos(data)
    }
    cargar()
  }, [])

  const agregar = (p) => setCarrito([...carrito, p])
  const limpiar = () => setCarrito([])
  
  const cobrar = async () => {
    if(total === 0) return
    await supabase.from('ventas').insert({ total, items: carrito })
    alert(`COBRADO $${total}`)
    limpiar()
  }

  const filtrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(filtro.toLowerCase()) || 
    String(p.plu).includes(filtro)
  )

  return (
    <div style={{ fontFamily:'Arial', padding:'20px', maxWidth:'900px', margin:'0 auto' }}>
      <h1 style={{textAlign:'center', background:'black', color:'white', padding:'15px'}}>LO DE ANY</h1>
      
      <input placeholder="Buscar por PLU o nombre..." 
        value={filtro} onChange={e=>setFiltro(e.target.value)}
        style={{width:'100%', padding:'15px', fontSize:'18px', marginBottom:'15px'}} />

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:'10px'}}>
        {filtrados.map(p=>(
          <button key={p.plu} onClick={()=>agregar(p)} 
            style={{padding:'15px', border:'2px solid black', background:'white', cursor:'pointer'}}>
            <div style={{fontSize:'30px'}}>{p.foto || '🧀'}</div>
            <div style={{fontWeight:'bold'}}>{p.nombre}</div>
            <div>${p.precio_kg}</div>
          </button>
        ))}
      </div>

      <div style={{marginTop:'30px', borderTop:'3px solid black', paddingTop:'20px'}}>
        <h2>Carrito: {carrito.length} - Total ${total}</h2>
        {carrito.map((c,i)=><div key={i}>- {c.nombre}</div>)}
        <br/>
        <button onClick={cobrar} style={{padding:'15px 30px', background:'black', color:'white', fontSize:'20px', cursor:'pointer'}}>COBRAR</button>
        <button onClick={limpiar} style={{padding:'15px', marginLeft:'10px', cursor:'pointer'}}>Limpiar</button>
      </div>
    </div>
  )
}